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
import { Context } from '../scope'
import { concatVid, idToVid, vidFromScope, vidFromString, vidToString } from '../scope/util'
import { VariantDef, resolveVid } from '../scope/vid'
import { assert, todo, unreachable } from '../util/todo'
import { semanticError } from './error'

export interface MatchTree {
    node: MatchNode
}
export type MatchNode = MatchType | MatchVariant | Exhaustive | Unmatched

export interface MatchType {
    kind: 'type'
    def: VariantDef
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
    let tree: MatchTree = { node: { kind: 'unmatched' } }

    for (const clause of matchExpr.clauses) {
        const nodeAffected = matchPattern(clause.pattern.expr, tree, ctx)
        if (!nodeAffected) {
            ctx.warnings.push(semanticError(ctx, clause, `unreachable pattern`))
        }
    }

    if (!isExhaustive(tree.node)) {
        const ps = unmatchedPaths(tree.node)
        const pathsStr = ps.map(p => `    ${p} {}`).join('\n')
        ctx.errors.push(semanticError(ctx, matchExpr, `non-exhaustive match expression, unmatched paths:\n${pathsStr}`))
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
            // match the node
            return true
        case 'con-pattern':
            // if node is not of kind `type`, make it so and populate every variant as unmatched
            const vid = idToVid(pattern.identifier)
            if (tree.node.kind !== 'type') {
                const ref = resolveVid(vid, ctx, ['variant'])
                const def = ref?.def
                if (!def || def.kind !== 'variant') throw Error(`\`${vidToString(vid)}\` not found`)

                const variants: Map<string, MatchTree> = new Map(
                    def.typeDef.variants.map(v => {
                        // TODO: is full qualifier needed here? or Type::Variant is enough
                        const variantVid = concatVid(vidFromScope(vid), vidFromString(v.name.value))
                        return [vidToString(variantVid), { node: { kind: 'unmatched' } }]
                    })
                )
                tree.node = { kind: 'type', def, variants }
            }
            const conName = pattern.identifier.name.value
            let variantTree = tree.node.variants.get(vidToString(vid))
            if (!variantTree) throw Error()
            // if this variant hasn't been explored yet, populate fields as unmatched
            if (variantTree.node.kind !== 'variant') {
                const variantDef = tree.node.def.typeDef.variants.find(v => v.name.value === conName)
                if (!variantDef) throw Error()
                variantTree.node = {
                    kind: 'variant',
                    fields: new Map(variantDef.fieldDefs.map(f => [f.name.value, { node: { kind: 'unmatched' } }]))
                }
            }
            const fields = [...variantTree.node.fields.values()]
            // if every variant field is already exhaustive, pattern is unreachable
            if (fields.length > 0 && fields.every(f => isExhaustive(f.node))) {
                return false
            }
            // if pattern has no fields, exhaust every field of that variant
            if (pattern.fieldPatterns.length === 0) {
                fields.forEach(f => (f.node = { kind: 'exhaustive' }))
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
        case 'operand-expr':
            return todo(`pattern \`${pattern.kind}\``)
        default:
            return unreachable(pattern.kind)
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

/**
 * @returns a list of strings each representing missing pattern, e.g. Option::Some(value: _)
 */
const unmatchedPaths = (node: MatchNode): string[] => {
    switch (node.kind) {
        case 'type':
            return [...node.variants.entries()].flatMap(([name, n]) => {
                return unmatchedPaths(n.node).map(v => {
                    if (v === '_') return `${name}()`
                    return `${name}(${v})`
                })
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
