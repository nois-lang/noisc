import { AstNode } from '../ast'
import { FnDef } from '../ast/statement'
import { Type } from '../ast/type'
import { Context } from '../scope'
import { operatorImplMap } from '../semantic/op'
import { addBounds, makeInferredType, makeReturnType } from '../typecheck'
import { boolId, charId, floatId, intId, stringId } from '../typecheck/type'
import { assert } from '../util/todo'
import { findById, findParent } from './name-resolve'

/**
 * Assign every suitable node its type and type bounds
 */
export const collectTypeBounds = (node: AstNode, ctx: Context, parentBound?: Type): void => {
    if (node.kind === 'inferred') return
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
            node.type ??= makeInferredType()
    }
    if (node.type && parentBound) {
        addBounds(node.type, [parentBound])
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
            // TODO: handle self
            if (node.paramType) break
            addBounds(node.type!, [node.paramType!])
            collectTypeBounds(node.pattern, ctx, node.paramType)
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
                if (node.def.kind === 'name') {
                    node.def.type ??= makeInferredType()
                    node.type = node.def.type
                }
            }
            break
        }
        case 'string-interpolated': {
            node.tokens.filter(t => typeof t !== 'string').forEach(t => collectTypeBounds(t, ctx))
            addBounds(node.type!, [stringId])
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
                    node.op.args.forEach(a => collectTypeBounds(a, ctx))
                    const fnType = node.operand.type!
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
            collectTypeBounds(node.lOperand, ctx)
            collectTypeBounds(node.rOperand, ctx)
            const methodId = operatorImplMap.get(node.binaryOp.kind)
            assert(!!methodId)
            const methodDef = findById(methodId!, ctx)
            assert(!!methodDef)
            const op = node.binaryOp
            op.type = makeInferredType()
            const fnType = methodDef!.type!
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
                collectTypeBounds(node.expr, ctx, node.varType)
            }
            collectTypeBounds(node.pattern, ctx, node.expr?.type)
            break
        }
        case 'fn-def': {
            if (node.block) {
                collectTypeBounds(node.block, ctx)
            }
            // TODO
            break
        }
        case 'trait-def': {
            // TODO
            break
        }
        case 'impl-def': {
            // TODO
            break
        }
        case 'string-literal': {
            addBounds(node.type!, [stringId])
            break
        }
        case 'char-literal': {
            addBounds(node.type!, [charId])
            break
        }
        case 'int-literal': {
            addBounds(node.type!, [intId])
            break
        }
        case 'float-literal': {
            addBounds(node.type!, [floatId])
            break
        }
        case 'bool-literal': {
            addBounds(node.type!, [boolId])
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

const boundFromCall = (args: Type[]): Type => {
    return { kind: 'fn-type', generics: [], paramTypes: args, returnType: { kind: 'hole' } }
}
