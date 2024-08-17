import { AstNode } from '../ast'
import { FnDef } from '../ast/statement'
import { Context, addError } from '../scope'
import { genericError } from '../semantic/error'
import { operatorImplMap } from '../semantic/op'
import {
    InferredType,
    addBounds,
    instantiateTemplateType,
    makeInferredFromType,
    makeInferredType,
    makeReturnType
} from '../typecheck'
import { boolType, charType, floatType, intType, stringType, unitType } from '../typecheck/type'
import { assert } from '../util/todo'
import { findById, findParent } from './name-resolve'

/**
 * Assign every suitable node its type and type bounds
 */
export const collectTypeBounds = (node: AstNode, ctx: Context, parentBound?: InferredType): void => {
    const m = ctx.moduleStack.at(-1)!
    m.astStack.push(node)
    switch (node.kind) {
        case 'variant':
        case 'return-stmt':
        case 'arg':
        case 'block':
        case 'param':
        case 'generic':
        case 'match-clause':
        case 'identifier':
        case 'name':
        case 'string-interpolated':
        case 'operand-expr':
        case 'unary-expr':
        case 'binary-expr':
        case 'closure-expr':
        case 'list-expr':
        case 'while-expr':
        case 'for-expr':
        case 'match-expr':
        case 'field-def':
        case 'string-literal':
        case 'char-literal':
        case 'int-literal':
        case 'float-literal':
        case 'bool-literal':
        case 'var-def':
            node.type ??= makeInferredType()
    }
    if (node.type && node.type.kind === 'inferred') {
        if (parentBound) {
            addBounds(node.type, [parentBound])
        }
    }
    switch (node.kind) {
        case 'module': {
            node.block.statements.forEach(s => collectTypeBounds(s, ctx))
            break
        }
        case 'variant': {
            // TODO
            break
        }
        case 'return-stmt': {
            collectTypeBounds(node.returnExpr, ctx)
            const fnDef = <FnDef | undefined>findParent(ctx, ['fn-def'])
            if (fnDef?.block) {
                addBounds(fnDef.block.type!, [node.returnExpr.type!])
            }
            break
        }
        case 'arg': {
            collectTypeBounds(node.expr, ctx)
            addBounds(node.type!, [node.expr.type!])
            break
        }
        case 'block': {
            node.statements.forEach(s => collectTypeBounds(s, ctx))
            const lastStmt = node.statements.at(-1)
            if (lastStmt) {
                addBounds(node.type!, [lastStmt.type!])
            }
            break
        }
        case 'param': {
            if (!node.paramType) break
            collectTypeBounds(node.paramType, ctx)
            const pType =
                node.paramType.kind === 'identifier' && node.paramType.def
                    ? node.paramType.def.type!
                    : makeInferredFromType(node.paramType)
            addBounds(node.type!, [pType])
            collectTypeBounds(node.pattern, ctx, pType)
            break
        }
        case 'generic': {
            // TODO
            break
        }
        case 'match-clause': {
            // TODO
            break
        }
        case 'pattern': {
            collectTypeBounds(node.expr, ctx, parentBound)
            break
        }
        case 'con-pattern': {
            // TODO
            break
        }
        case 'list-pattern': {
            // TODO
            break
        }
        case 'field-pattern': {
            // TODO
            break
        }
        case 'hole': {
            // TODO
            break
        }
        case 'identifier':
        case 'name': {
            if (node.def) {
                node.type = instantiateTemplateType(node.def.type!)
                break
            }
            break
        }
        case 'operand-expr': {
            collectTypeBounds(node.operand, ctx)
            node.type = node.operand.type
            break
        }
        case 'unary-expr': {
            collectTypeBounds(node.operand, ctx)
            switch (node.op.kind) {
                case 'call-op': {
                    const fnType = instantiateTemplateType(node.operand.type!)
                    node.op.args.forEach(a => collectTypeBounds(a, ctx))
                    addBounds(fnType, [boundFromCall(node.op.args.map(a => a.type!))])
                    node.type = makeReturnType(fnType)
                    break
                }
                case 'method-call-op':
                case 'field-access-op':
                case 'unwrap-op':
                case 'bind-op':
                case 'await-op': {
                    // TODO
                    break
                }
            }
            break
        }
        case 'binary-expr': {
            if (node.binaryOp.kind === 'assign-op') {
                // TODO
                break
            }
            collectTypeBounds(node.lOperand, ctx)
            collectTypeBounds(node.rOperand, ctx)
            const methodId = operatorImplMap.get(node.binaryOp.kind)
            assert(!!methodId)
            const methodDef = findById(methodId!, ctx)
            assert(!!methodDef)
            const fnType = instantiateTemplateType(methodDef!.type!)
            addBounds(fnType, [boundFromCall([node.lOperand.type!, node.rOperand.type!])])
            node.type = makeReturnType(fnType)
            break
        }
        case 'closure-expr': {
            // TODO
            break
        }
        case 'list-expr': {
            // TODO
            break
        }
        case 'while-expr': {
            // TODO
            break
        }
        case 'for-expr': {
            // TODO
            break
        }
        case 'match-expr': {
            // TODO
            break
        }
        case 'var-def': {
            if (node.expr) {
                collectTypeBounds(node.expr, ctx, node.varType ? makeInferredFromType(node.varType) : undefined)
            }
            collectTypeBounds(node.pattern, ctx, node.expr?.type)
            node.type = instantiateTemplateType(unitType)
            break
        }
        case 'fn-def': {
            node.generics.forEach(g => collectTypeBounds(g, ctx))
            node.params.forEach(p => collectTypeBounds(p, ctx))
            if (node.block) {
                if (node.type?.kind !== 'template' || node.type.type.kind !== 'inferred-fn') {
                    addError(ctx, genericError(ctx, node, 'no type'))
                    break
                    // return unreachable()
                }
                collectTypeBounds(node.block, ctx, node.type.type.returnType)
            }
            break
        }
        case 'trait-def':
        case 'impl-def': {
            if (node.kind === 'impl-def' && node.forTrait) break
            node.block.statements.forEach(s => collectTypeBounds(s, ctx))
            // TODO
            break
        }
        case 'string-interpolated': {
            node.tokens.filter(t => typeof t !== 'string').forEach(t => collectTypeBounds(t, ctx))
            node.type = instantiateTemplateType(stringType)
            break
        }
        case 'string-literal': {
            node.type = instantiateTemplateType(stringType)
            break
        }
        case 'char-literal': {
            node.type = instantiateTemplateType(charType)
            break
        }
        case 'int-literal': {
            node.type = instantiateTemplateType(intType)
            break
        }
        case 'float-literal': {
            node.type = instantiateTemplateType(floatType)
            break
        }
        case 'bool-literal': {
            node.type = instantiateTemplateType(boolType)
            break
        }
        case 'method-call-op': {
            // TODO
            break
        }
        case 'field-access-op': {
            // TODO
            break
        }
    }
    m.astStack.pop()
}

const boundFromCall = (args: InferredType[]): InferredType => {
    return { kind: 'inferred-fn', generics: [], params: args, returnType: { kind: 'hole' } }
}
