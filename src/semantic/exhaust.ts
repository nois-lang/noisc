/*
 * Match exhaustion logic
 *
 * type Expr {
 *     Add(l: Expr, r: Expr),
 *     Const(v: Int)
 * }
 *
 * match expr {
 *     Expr::Add(l: Expr::Const) {},  // 1
 *     Expr::Add() {},                // 2
 *     Expr::Const() {},              // 3
 *     _ {},                          // 4
 * }
 *
 * 0: Expr?
 * 1: Expr{Add(l: Expr{Add(l?, r?), Const(v)}, r?), Const(v?)}
 * 2: Expr{Add(l                             , r ), Const(v?)}
 * 3: Expr{Add(l                             , r ), Const(v )}
 * 4: Expr{Add(l                             , r ), Const(v )} // note that every path is already covered
 *
 * - clause must exhaust previously unmatched paths or introduce new paths
 * - if clause does not affect match tree, it cannot be matched. Should be a warning
 * - if there are unexplored paths after the last clause, there is a value that will never match. Should be an error
 * - guarded clause does not exhaust any path, since condition is statically undecidable
 */

import { MatchExpr, PatternExpr } from '../ast/match'
import { Context, addError, addWarning } from '../scope'
import { concatVid, idToVid, vidFromScope, vidFromString, vidToString } from '../scope/util'
import { VariantDef, VirtualIdentifierMatch, resolveVid } from '../scope/vid'
import { assert, unreachable } from '../util/todo'
import { nonExhaustiveMatchError, unreachableMatchClauseError } from './error'

export interface MatchTree {
    node: MatchNode
}
export type MatchNode = MatchType | MatchVariant | Exhaustive | Unmatched

export interface MatchType {
    kind: 'type'
    ref: VirtualIdentifierMatch<VariantDef>
    variants: Map<string, MatchTree>
}

export interface MatchVariant {
    kind: 'variant'
    fields: Map<string, MatchTree>
}

export interface Exhaustive {
    kind: 'exhaustive'
}

export interface Unmatched {
    kind: 'unmatched'
}

export const checkExhaustion = (matchExpr: MatchExpr, ctx: Context): MatchTree => {
    const tree: MatchTree = { node: { kind: 'unmatched' } }

    for (const clause of matchExpr.clauses) {
        let clauseAffected = false
        for (const p of clause.patterns) {
            const nodeAffected = matchPattern(p.expr, tree, ctx)
            if (nodeAffected) {
                clauseAffected = true
            }
        }
        if (!clauseAffected) {
            addWarning(ctx, unreachableMatchClauseError(ctx, clause))
        }
    }

    if (!isExhaustive(tree.node)) {
        addError(ctx, nonExhaustiveMatchError(ctx, matchExpr, tree))
    }

    return tree
}

const matchPattern = (pattern: PatternExpr, tree: MatchTree, ctx: Context): boolean => {
    if (isExhaustive(tree.node)) {
        // attempt to match already exhaustive node means that it will never match
        return false
    }
    switch (pattern.kind) {
        case 'name':
        case 'hole':
            // exhaust the node
            tree.node = { kind: 'exhaustive' }
            return true
        case 'string-literal':
        case 'char-literal':
        case 'unary-expr':
        case 'operand-expr':
            // match the node
            return true
        case 'con-pattern':
            // if node is not of kind `type`, make it so and populate every variant as unmatched
            const vid = idToVid(pattern.identifier)
            if (tree.node.kind !== 'type') {
                const ref = resolveVid(vid, ctx, ['variant'])
                if (!ref || ref.def.kind !== 'variant') throw Error(`\`${vidToString(vid)}\` not found`)

                const variants: Map<string, MatchTree> = new Map(
                    ref.def.typeDef.variants.map(v => {
                        const variantVid = concatVid(vidFromScope(vid), vidFromString(v.name.value))
                        return [vidToString(variantVid), { node: { kind: 'unmatched' } }]
                    })
                )
                tree.node = { kind: 'type', ref: <VirtualIdentifierMatch<VariantDef>>ref, variants }
            }
            const conName = pattern.identifier.names.at(-1)!.value
            const variantTree = tree.node.variants.get(vidToString(vid))
            if (!variantTree) throw Error()
            // if this variant hasn't been explored yet, populate fields as unmatched
            if (variantTree.node.kind !== 'variant') {
                const variantDef = tree.node.ref.def.typeDef.variants.find(v => v.name.value === conName)
                if (!variantDef) throw Error()
                const fields = new Map<string, MatchTree>(
                    variantDef.fieldDefs
                        .filter(f => f.pub || (<MatchType>tree.node).ref.module === ctx.moduleStack.at(-1)!)
                        .map(f => [f.name.value, { node: { kind: 'unmatched' } }])
                )
                variantTree.node = {
                    kind: 'variant',
                    fields
                }
            }
            const fields = [...variantTree.node.fields.values()]
            // if every variant field is already exhaustive, pattern is unreachable
            if (fields.length > 0 && fields.every(f => isExhaustive(f.node))) {
                return false
            }
            // if pattern has no fields, exhaust every field of that variant
            if (pattern.fieldPatterns.length === 0) {
                fields.forEach(f => {
                    f.node = { kind: 'exhaustive' }
                })
                return true
            }
            // if this variant has unmatched fields, recursively match every pattern field
            let matched = false
            for (const f of pattern.fieldPatterns) {
                const fName = f.name.value
                const fTree = (<MatchVariant>variantTree!.node).fields.get(fName)
                assert(!!fTree, `unknown field \`${fName}\``)
                if (!f.pattern) {
                    // no pattern is analogous to `_`
                    fTree!.node = { kind: 'exhaustive' }
                    matched = true
                } else {
                    matched = matchPattern(f.pattern.expr, fTree!, ctx)
                }
            }
            return matched
        default:
            return unreachable(pattern.kind)
    }
}

/**
 * @returns a list of strings each representing missing pattern, e.g. Option::Some(value: _)
 */
export const unmatchedPaths = (node: MatchNode): string[] => {
    switch (node.kind) {
        case 'type':
            return [...node.variants.entries()].flatMap(([name, n]) => {
                if (n.node.kind === 'unmatched') return `${name}()`
                return unmatchedPaths(n.node).map(v => `${name}(${v})`)
            })
        case 'variant':
            const fields = [...node.fields.entries()].flatMap(([name, field]) => {
                return unmatchedPaths(field.node).map(n => `${name}: ${n}`)
            })
            return fields.length === 0 ? [] : [fields.join(', ')]
        case 'exhaustive':
            return []
        case 'unmatched':
            return ['_']
    }
}

const isExhaustive = (node: MatchNode): boolean => {
    switch (node.kind) {
        case 'type':
            return [...node.variants.values()].every(t => isExhaustive(t.node))
        case 'variant':
            return [...node.fields.values()].every(t => isExhaustive(t.node))
        case 'exhaustive':
            return true
        case 'unmatched':
            return false
    }
}
