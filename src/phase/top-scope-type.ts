import { AstNode } from '../ast'
import { Context } from '../scope'
import { makeDefType, makeTypeParam } from '../typecheck'
import { unitType } from '../typecheck/type'
import { assert, todo, unreachable } from '../util/todo'

/**
 * Set inferred types of topScope nodes
 */
export const setTopScopeType = (node: AstNode, ctx: Context) => {
    switch (node.kind) {
        case 'module': {
            node.block.statements.forEach(s => setTopScopeType(s, ctx))
            break
        }
        case 'var-def': {
            if (node.pattern.expr.kind !== 'name') return unreachable()
            const def = node.pattern.expr
            assert(!!node.varType)
            def.type = makeDefType(node.varType!)
            break
        }
        case 'fn-def': {
            if (node.instance) {
                node.generics.push(...node.instance.generics)
            }
            node.generics.forEach(g => setTopScopeType(g, ctx))
            node.params.forEach(p => setTopScopeType(p, ctx))
            assert(!!node.returnType)
            if (node.returnType) {
                setTopScopeType(node.returnType, ctx)
            }
            node.type = makeDefType({
                kind: 'fn-type',
                generics: node.generics,
                paramTypes: node.params.map(p => p.paramType!),
                returnType: node.returnType ? node.returnType : unitType.type
            })
            break
        }
        case 'type-def': {
            node.type = makeDefType(node.name)
            node.variants.forEach(v => {
                v.fieldDefs.forEach(f => setTopScopeType(f, ctx))
                const fnType = {
                    kind: <const>'fn-type',
                    generics: node.generics,
                    paramTypes: v.fieldDefs.map(f => f.fieldType),
                    returnType: node.name
                }
                setTopScopeType(fnType, ctx)
                v.type = makeDefType(fnType)
            })
            break
        }
        case 'field-def': {
            assert(!!node.fieldType)
            setTopScopeType(node.fieldType!, ctx)
            node.type = node.fieldType!.type!
            setTopScopeType(node.name, ctx)
            break
        }
        case 'trait-def':
        case 'impl-def': {
            if (node.kind === 'impl-def' && node.forTrait) break
            node.generics.forEach(g => setTopScopeType(g, ctx))
            node.block.statements.forEach(s => setTopScopeType(s, ctx))
            break
        }
        case 'param': {
            assert(!!node.paramType)
            setTopScopeType(node.paramType!, ctx)
            node.type = node.paramType!.type!
            setTopScopeType(node.pattern, ctx)
            break
        }
        case 'pattern': {
            if (node.expr.kind !== 'name') {
                return todo()
            }
            setTopScopeType(node.expr, ctx)
            break
        }
        case 'identifier': {
            node.typeArgs.forEach(ta => setTopScopeType(ta, ctx))
            node.type = node.def?.type ?? { kind: 'error', message: 'no def' }
            break
        }
        case 'name': {
            node.type = node.def?.type ?? { kind: 'error', message: 'no def' }
            break
        }
        case 'fn-type': {
            node.generics.forEach(pt => setTopScopeType(pt, ctx))
            node.paramTypes.forEach(pt => setTopScopeType(pt, ctx))
            setTopScopeType(node.returnType, ctx)
            node.type = makeDefType(node)
            break
        }
        case 'hole': {
            node.type = { kind: 'hole' }
            break
        }
        case 'generic': {
            node.type = makeTypeParam(node.name)
            break
        }
    }
}
