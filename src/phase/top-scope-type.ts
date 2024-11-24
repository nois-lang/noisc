import { AstNode } from '../ast'
import { Identifier } from '../ast/operand'
import { fieldToParamType, paramToParamType, typeToParamType } from '../ast/type'
import { Context } from '../scope'
import { makeErrorType, makeTypeParam } from '../typecheck'
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
            if (node.pattern.expr.kind !== 'name') return unreachable('top level destructuring')
            if (node.expr) {
                setTopScopeType(node.expr, ctx)
            }
            const def = node.pattern.expr
            def.type = node.expr?.type ?? makeErrorType()
            break
        }
        case 'operand-expr': {
            setTopScopeType(node.operand, ctx)
            node.type = node.operand.type
            break
        }
        case 'fn-def': {
            node.typeParams.forEach(g => setTopScopeType(g, ctx))
            node.params.forEach(p => setTopScopeType(p, ctx))
            if (node.returnType) {
                setTopScopeType(node.returnType!, ctx)
            }
            node.type = {
                kind: 'fn-type',
                typeParams: node.typeParams,
                paramTypes: node.params.map(paramToParamType),
                returnType: node.returnType ?? ctx.stdTypeIds.unit!
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
                typeArgs: node.typeDef!.typeParams.map(ta => ({
                    kind: 'identifier',
                    names: [ta.name],
                    typeArgs: [],
                    def: ta
                })),
                def: node.typeDef
            }
            const fnType: AstNode = {
                kind: <const>'fn-type',
                typeParams: node.typeDef!.typeParams,
                paramTypes: node.fields.map(f => fieldToParamType(f)),
                returnType: typeDefId
            }
            setTopScopeType(fnType, ctx)
            node.type = fnType
            break
        }
        case 'field-def': {
            assert(!!node.fieldType)
            setTopScopeType(node.fieldType!, ctx)
            // TODO: ugly
            const typeDef = node.variant!.typeDef!
            const typeDefId: Identifier = {
                kind: 'identifier',
                parseNode: node.parseNode,
                names: [typeDef.name],
                typeArgs: typeDef.typeParams.map(ta => ({
                    kind: 'identifier',
                    names: [ta.name],
                    typeArgs: [],
                    def: ta
                })),
                def: typeDef
            }
            const accessorType: AstNode = {
                kind: <const>'fn-type',
                typeParams: typeDef.typeParams,
                paramTypes: [typeToParamType(typeDefId)],
                returnType: node.fieldType
            }
            node.type = accessorType
            break
        }
        case 'trait-def':
        case 'impl-def': {
            node.typeParams.forEach(g => setTopScopeType(g, ctx))
            node.block.statements.forEach(s => {
                setTopScopeType(s, ctx)

                if (s.type?.kind !== 'fn-type') {
                    assert(false)
                    return
                }
                s.type!.typeParams.unshift(...node.typeParams)
            })
            break
        }
        case 'trait-statement': {
            setTopScopeType(node.expr, ctx)
            node.type = node.expr.type
            node.name.def = node
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
        case 'param-type': {
            setTopScopeType(node.paramType, ctx)
            node.type = node.paramType.type
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
