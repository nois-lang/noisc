import { inspect } from 'util'
import { AstNode } from '../ast'
import { FnDef } from '../ast/statement'
import { Context } from '../scope'
import { operatorImplMap } from '../semantic/op'
import {
    InferredType,
    addBounds,
    boundFromCall,
    instantiateDefType,
    makeErrorType,
    makeFieldAccessType,
    makeFieldPatternType,
    makeInferredType,
    makeMethodCallType,
    makeReturnType
} from '../typecheck'
import { assert, unreachable } from '../util/todo'
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
    if (node.kind !== 'match-clause') {
        if (node.type && node.type.kind === 'inferred') {
            if (parentBound) {
                addBounds(node.type, [parentBound])
            }
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
            if (node.statements.length === 0) {
                addBounds(node.type!, [
                    instantiateDefType(ctx.stdTypeIds.unit?.type ?? makeErrorType('no def', 'no-def'), ctx)
                ])
            }
            break
        }
        case 'param': {
            collectTypeBounds(node.pattern, ctx, instantiateDefType(node.paramType!.type!, ctx))
            break
        }
        case 'generic': {
            // TODO
            break
        }
        case 'match-clause': {
            node.type = makeInferredType()
            node.patterns.forEach(p => collectTypeBounds(p, ctx, parentBound))
            collectTypeBounds(node.block, ctx)
            addBounds(node.type!, [node.block.type!])
            // TODO
            break
        }
        case 'pattern': {
            collectTypeBounds(node.expr, ctx, parentBound)
            break
        }
        case 'con-pattern': {
            node.fieldPatterns.forEach(fp => collectTypeBounds(fp, ctx, parentBound))
            break
        }
        case 'field-pattern': {
            assert(!!parentBound)
            node.name.type = makeFieldPatternType(parentBound!, node)
            break
        }
        case 'list-pattern': {
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
                assert(!!node.def.type, `no def type ${inspect(node.def)}`)
                node.type = instantiateDefType(node.def.type!, ctx)
                break
            } else {
                node.type = makeInferredType()
                if (parentBound) {
                    addBounds(node.type!, [parentBound])
                }
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
                    const fnType = instantiateDefType(node.operand.type!, ctx)
                    node.op.args.forEach(a => collectTypeBounds(a, ctx))
                    addBounds(fnType, [boundFromCall(node.op.args.map(a => a.type!))])
                    node.type = makeReturnType(fnType)
                    break
                }
                case 'field-access-op': {
                    node.type = makeFieldAccessType(node)
                    break
                }
                case 'method-call-op':
                    node.op.call.args.forEach(a => collectTypeBounds(a, ctx))
                    node.type = makeMethodCallType(node)
                    break
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
            const fnType = instantiateDefType(methodDef!.type!, ctx)
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
            collectTypeBounds(node.expr, ctx)
            node.clauses.forEach(c => collectTypeBounds(c, ctx, node.expr.type!))
            addBounds(
                node.type!,
                node.clauses.map(c => c.type!)
            )
            break
        }
        case 'var-def': {
            if (node.expr) {
                collectTypeBounds(node.expr, ctx, node.varType ? node.varType : undefined)
            }
            collectTypeBounds(node.pattern, ctx, node.expr?.type)
            node.type = instantiateDefType(ctx.stdTypeIds.unit?.type ?? makeErrorType('no def', 'no-def'), ctx)
            break
        }
        case 'fn-def': {
            node.generics.forEach(g => collectTypeBounds(g, ctx))
            node.params.forEach(p => collectTypeBounds(p, ctx))
            if (node.block) {
                if (node.type?.kind !== 'fn-type') {
                    unreachable()
                    break
                }
                collectTypeBounds(node.block, ctx, node.type.returnType.type)
            }
            break
        }
        case 'trait-def':
        case 'impl-def': {
            // TODO
            if (node.kind === 'impl-def' && node.forTrait) {
                break
            }
            node.block.statements.forEach(s => collectTypeBounds(s, ctx))
            break
        }
        case 'string-interpolated': {
            node.tokens.filter(t => typeof t !== 'string').forEach(t => collectTypeBounds(t, ctx))
            node.type = instantiateDefType(ctx.stdTypeIds.string?.type ?? makeErrorType('no def', 'no-def'), ctx)
            break
        }
        case 'string-literal': {
            node.type = instantiateDefType(ctx.stdTypeIds.string?.type ?? makeErrorType('no def', 'no-def'), ctx)
            break
        }
        case 'char-literal': {
            node.type = instantiateDefType(ctx.stdTypeIds.char?.type ?? makeErrorType('no def', 'no-def'), ctx)
            break
        }
        case 'int-literal': {
            node.type = instantiateDefType(ctx.stdTypeIds.int?.type ?? makeErrorType('no def', 'no-def'), ctx)
            break
        }
        case 'float-literal': {
            node.type = instantiateDefType(ctx.stdTypeIds.float?.type ?? makeErrorType('no def', 'no-def'), ctx)
            break
        }
        case 'bool-literal': {
            node.type = instantiateDefType(ctx.stdTypeIds.bool?.type ?? makeErrorType('no def', 'no-def'), ctx)
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
