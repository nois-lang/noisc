import { AstNode } from '../ast'
import { Identifier } from '../ast/operand'
import { Context } from '../scope'
import { makeErrorType, makeTypeParam } from '../typecheck'
import { assert, todo, unreachable } from '../util/todo'

/**
 * Set inferred def types of topScope nodes
 */
export const setTopScopeDefType = (node: AstNode, ctx: Context) => {
    switch (node.kind) {
        case 'module': {
            node.block.statements.forEach(s => setTopScopeDefType(s, ctx))
            break
        }
        case 'trait-def': {
            node.typeParams.forEach(g => setTopScopeDefType(g, ctx))
            break
        }
        case 'type-def': {
            node.typeParams.forEach(g => setTopScopeDefType(g, ctx))
            break
        }
        case 'type-param': {
            node.type = makeTypeParam(node)
            break
        }
    }
}

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
            def.type = node.varType ?? makeErrorType()
            break
        }
        case 'fn-def': {
            node.typeParams.forEach(g => setTopScopeType(g, ctx))
            node.params.forEach(p => setTopScopeType(p, ctx))
            assert(!!node.returnType)
            setTopScopeType(node.returnType!, ctx)
            node.type = {
                kind: 'fn-type',
                typeParams: node.typeParams,
                paramTypes: node.params.map(p => p.paramType!),
                returnType: node.returnType!
            }
            break
        }
        case 'type-def': {
            node.variants.forEach(v => setTopScopeType(v, ctx))
            break
        }
        case 'variant': {
            node.fields.forEach(f => setTopScopeType(f, ctx))
            // TODO: ugly
            const typeDefId: Identifier = {
                kind: 'identifier',
                parseNode: node.parseNode,
                names: [node.typeDef!.name],
                typeArgs: node.typeDef!.typeParams.map(g => ({
                    kind: 'identifier',
                    names: [g.name],
                    typeArgs: [],
                    def: g
                })),
                def: node.typeDef
            }
            const fnType = {
                kind: <const>'fn-type',
                generics: node.typeDef!.typeParams,
                paramTypes: node.fields.map(f => f.fieldType),
                returnType: typeDefId
            }
            setTopScopeType(fnType, ctx)
            node.type = fnType
            break
        }
        case 'field-def': {
            assert(!!node.fieldType)
            setTopScopeType(node.fieldType!, ctx)
            node.type = node.fieldType!
            setTopScopeType(node.name, ctx)
            break
        }
        case 'trait-def':
        case 'impl-def': {
            node.typeParams.forEach(g => setTopScopeType(g, ctx))
            node.block.statements.forEach(s => setTopScopeType(s, ctx))
            break
        }
        case 'param': {
            assert(!!node.paramType)
            setTopScopeType(node.paramType!, ctx)
            node.type = node.paramType!.type!
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
            node.type = node
            break
        }
        case 'fn-type': {
            node.typeParams.forEach(pt => setTopScopeType(pt, ctx))
            node.paramTypes.forEach(pt => setTopScopeType(pt, ctx))
            setTopScopeType(node.returnType, ctx)
            node.type = node
            break
        }
        case 'hole': {
            node.type = { kind: 'hole' }
            break
        }
        case 'type-param': {
            node.type = makeTypeParam(node)
            break
        }
    }
}
