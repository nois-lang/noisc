import { AstNode } from '../ast'
import { Type } from '../ast/type'
import { Context } from '../scope'
import { InferredType, makeInferredType, resolveTypeRef } from '../typecheck'
import { boolVid, charVid, floatVid, intVid, stringVid } from '../typecheck/type'

/**
 * Assign every suitable node its type and type bounds
 */
export const collectTypeBounds = (node: AstNode, ctx: Context, parentBound?: Type): InferredType | undefined => {
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
            return undefined
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
            // TODO
            break
        }
        case 'param': {
            // TODO: handle self
            if (node.paramType) return undefined
            collectTypeBounds(node.pattern, ctx, node.paramType)
            return node.paramType
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
                return { kind: 'ref', ref: resolveTypeRef(node.def.type) }
            }
            // TODO
            break
        }
        case 'string-interpolated': {
            node.tokens.filter(t => typeof t !== 'string').forEach(t => collectTypeBounds(t, ctx))
            addBound(node.type!, stringVid)
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
            // TODO
            break
        }
        case 'fn-def': {
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
            addBound(node.type!, stringVid)
            break
        }
        case 'char-literal': {
            addBound(node.type!, charVid)
            break
        }
        case 'int-literal': {
            addBound(node.type!, intVid)
            break
        }
        case 'float-literal': {
            addBound(node.type!, floatVid)
            break
        }
        case 'bool-literal': {
            addBound(node.type!, boolVid)
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

const addBound = (type: InferredType, bound: Type): void => {
    resolveTypeRef(type).bounds.push(bound)
}
