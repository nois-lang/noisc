import { AstNode } from '../ast'
import { Context } from '../scope'
import { InferredType, makeInferredType } from '../typecheck'
import { boolVid, charVid, floatVid, intVid, stringVid } from '../typecheck/type'

/**
 * Assign every suitable node its type and type bounds
 */
export const collectTypeBounds = (node: AstNode, ctx: Context, parentBound?: InferredType) => {
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
        addBound(node.type, parentBound)
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
            // TODO
            break
        }
        case 'arg': {
            // TODO
            break
        }
        case 'block': {
            node.statements.forEach(s => collectTypeBounds(s, ctx))
            // TODO
            break
        }
        case 'param': {
            // TODO: handle self
            if (node.paramType) return undefined
            node.type!.known = node.paramType
            collectTypeBounds(node.pattern, ctx, node.paramType)
            return node.type
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
            // TODO
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
                if (
                    node.def.kind === 'trait-def' ||
                    node.def.kind === 'impl-def' ||
                    node.def.kind === 'type-def' ||
                    node.def.kind === 'module'
                )
                    return undefined
                node.def.type ??= makeInferredType()
                return node.def.type
            }
            // TODO
            break
        }
        case 'string-interpolated': {
            node.tokens.filter(t => typeof t !== 'string').forEach(t => collectTypeBounds(t, ctx))
            node.type!.known = stringVid
            break
        }
        case 'operand-expr': {
            // TODO
            break
        }
        case 'unary-expr': {
            // TODO
            break
        }
        case 'binary-expr': {
            collectTypeBounds(node.lOperand, ctx)
            collectTypeBounds(node.rOperand, ctx)
            // TODO
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
                collectTypeBounds(node.expr, ctx)
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
            node.type!.known = stringVid
            break
        }
        case 'char-literal': {
            node.type!.known = charVid
            break
        }
        case 'int-literal': {
            node.type!.known = intVid
            break
        }
        case 'float-literal': {
            node.type!.known = floatVid
            break
        }
        case 'bool-literal': {
            node.type!.known = boolVid
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
        case 'call-op': {
            // TODO
            break
        }
        case 'unwrap-op': {
            // TODO
            break
        }
        case 'bind-op': {
            // TODO
            break
        }
        case 'await-op': {
            // TODO
            break
        }
    }
    return node.type
}

const addBound = (type: InferredType, bound: InferredType): void => {
    type.bounds.push(bound)
}
