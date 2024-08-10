import { AstNode } from '../ast'
import { Identifier } from '../ast/operand'
import { Context } from '../scope'
import { makeInferredType } from '../typecheck'
import { unitId } from '../typecheck/type'
import { setKnown } from './type-bound'

/**
 * Set known types of topScope nodes
 */
export const setTopScopeType = (node: AstNode, ctx: Context, parent?: AstNode) => {
    switch (node.kind) {
        case 'module': {
            node.block.statements.forEach(s => setTopScopeType(s, ctx))
            break
        }
        case 'var-def': {
            if (node.pattern.expr.kind !== 'name') break
            const def = node.pattern.expr
            def.type = makeInferredType()
            setKnown(def.type, node.varType)
            break
        }
        case 'fn-def': {
            node.params.forEach(p => {
                p.type = makeInferredType()
                if (p.paramType) {
                    setKnown(p.type, p.paramType)
                }
            })
            node.type = makeInferredType()
            setKnown(node.type, {
                kind: 'fn-type',
                parseNode: node.name.parseNode,
                generics: node.generics,
                paramTypes: node.params.map(p =>
                    p.type?.kind === 'inferred' && p.type.known ? p.type.known : { kind: 'hole' }
                ),
                returnType: node.returnType ?? unitId
            })
            break
        }
        case 'type-def': {
            // TODO: generics
            const nodeId: Identifier = {
                kind: 'identifier',
                parseNode: node.name.parseNode,
                names: [node.name],
                typeArgs: []
            }
            node.variants.forEach(v => {
                v.fieldDefs.forEach(f => {
                    f.type = makeInferredType()
                    setKnown(f.type, f.fieldType)
                })
                v.type = makeInferredType()
                setKnown(v.type, {
                    kind: 'fn-type',
                    parseNode: node.name.parseNode,
                    generics: node.generics,
                    paramTypes: v.fieldDefs.map(f => f.type!.known!),
                    returnType: nodeId
                })
            })
            break
        }
        case 'trait-def':
        case 'impl-def': {
            if (node.kind === 'impl-def' && node.forTrait) break
            node.block.statements.forEach(s => setTopScopeType(s, ctx, node))
            break
        }
    }
}
