import { AstNode } from '../ast'
import { Identifier } from '../ast/operand'
import { Context } from '../scope'
import { makeInferredFromType, makeInferredType, makeTemplateType } from '../typecheck'
import { unitType } from '../typecheck/type'

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
            if (node.pattern.expr.kind !== 'name') break
            const def = node.pattern.expr
            def.type = makeTemplateType(makeInferredFromType(node.varType!))
            break
        }
        case 'fn-def': {
            const generics = node.generics
            if (node.instance) {
                generics.push(...node.instance.generics)
            }
            node.type = makeTemplateType({
                kind: 'inferred-fn',
                generics,
                params: node.params.map(p => makeInferredFromType(p.paramType!)),
                returnType: node.returnType ? makeInferredFromType(node.returnType) : unitType
            })
            break
        }
        case 'type-def': {
            // TODO: generics
            const nodeId: Identifier = {
                kind: 'identifier',
                parseNode: node.name.parseNode,
                names: [node.name],
                typeArgs: [],
                def: node
            }
            node.type = makeInferredFromType(nodeId)
            node.variants.forEach(v => {
                v.type = makeTemplateType({
                    kind: 'inferred-fn',
                    generics: node.generics,
                    params: v.fieldDefs.map(f => makeInferredFromType(f.fieldType)),
                    returnType: nodeId
                })
            })
            break
        }
        case 'trait-def':
        case 'impl-def': {
            if (node.kind === 'impl-def' && node.forTrait) break
            node.generics.forEach(g => setTopScopeType(g, ctx))
            node.block.statements.forEach(s => setTopScopeType(s, ctx))
            break
        }
        case 'generic': {
            node.type = makeInferredType()
        }
    }
}
