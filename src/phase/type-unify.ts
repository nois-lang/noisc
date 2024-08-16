import { AstNode } from '../ast'
import { Context } from '../scope'
import { InferredType, inferredTypeToString, typeToString } from '../typecheck'
import { zip } from '../util/array'
import { todo, unreachable } from '../util/todo'

/**
 * Unify type bounds
 */
export const unifyTypeBounds = (node: AstNode, ctx: Context): void => {
    if (node.type) {
        unifyType(node.type)
    }
    switch (node.kind) {
        case 'module': {
            node.block.statements.forEach(s => unifyTypeBounds(s, ctx))
            break
        }
        case 'variant': {
            // TODO
            break
        }
        case 'return-stmt': {
            unifyTypeBounds(node.returnExpr, ctx)
            break
        }
        case 'arg': {
            unifyTypeBounds(node.expr, ctx)
            break
        }
        case 'block': {
            node.statements.forEach(s => unifyTypeBounds(s, ctx))
            break
        }
        case 'param': {
            unifyTypeBounds(node.pattern, ctx)
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
            unifyTypeBounds(node.expr, ctx)
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
            break
        }
        case 'string-interpolated': {
            break
        }
        case 'operand-expr': {
            unifyTypeBounds(node.operand, ctx)
            break
        }
        case 'unary-expr': {
            unifyTypeBounds(node.operand, ctx)
            switch (node.op.kind) {
                case 'call-op': {
                    node.op.args.forEach(a => unifyTypeBounds(a, ctx))
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
            unifyTypeBounds(node.lOperand, ctx)
            unifyTypeBounds(node.rOperand, ctx)
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
                unifyTypeBounds(node.expr, ctx)
            }
            unifyTypeBounds(node.pattern, ctx)
            break
        }
        case 'fn-def': {
            node.params.forEach(p => unifyTypeBounds(p, ctx))
            if (node.block) {
                unifyTypeBounds(node.block, ctx)
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
        case 'method-call-op': {
            // TODO
            break
        }
        case 'field-access-op': {
            // TODO
            break
        }
    }
}

const unifyType = (type: InferredType): void => {
    switch (type.kind) {
        case 'inferred': {
            const unified = type.bounds.reduce<InferredType | undefined>(
                (a, b) => {
                    if (!a || !b) return undefined
                    return unify(a, b)
                },
                { kind: 'hole' }
            )
            if (!unified) {
                Object.assign(type, { kind: 'error' })
                break
            }
            Object.assign(type, unified)
            break
        }
        case 'inferred-fn':
            // TODO
            break
        case 'return':
            unifyType(type.type)
            const ret = extractReturnType(type.type)
            if (!ret) {
                Object.assign(type, { kind: 'error' })
                break
            }
            Object.assign(type, ret)
            break
        case 'hole':
        case 'template':
        case 'error':
            break
    }
}

const unify = (a: InferredType, b: InferredType): InferredType => {
    const aStr = inferredTypeToString(a)
    const bStr = inferredTypeToString(b)
    const u1 = unify_(a, b)
    if (u1.kind !== 'error') {
        console.log('unified', aStr, bStr, inferredTypeToString(u1))
        return u1
    }
    const u2 = unify_(b, a)
    if (u2.kind === 'error') {
        console.log('error', inferredTypeToString(a), inferredTypeToString(b))
    } else {
        console.log('unified', aStr, bStr, inferredTypeToString(u2))
    }
    return u2
}

const unify_ = (a: InferredType, b: InferredType): InferredType => {
    unifyType(a)
    unifyType(b)
    switch (a.kind) {
        case 'inferred-fn':
            switch (b.kind) {
                case 'inferred-fn':
                    const t: InferredType = {
                        kind: 'inferred-fn',
                        // TODO
                        generics: [],
                        params: zip(a.params, b.params, unify),
                        returnType: unify(a.returnType, b.returnType)
                    }
                    return t
                case 'identifier':
                case 'hole':
                case 'error':
                    todo(b.kind)
                    break
                case 'template':
                case 'inferred':
                case 'return':
                    unreachable()
                    break
            }
            break
        case 'identifier':
            if (a.def?.kind === 'generic') {
                if (b.kind !== 'hole') {
                    Object.assign(a, b)
                }
            }
            switch (b.kind) {
                case 'identifier':
                    // TODO
                    if (typeToString(a) === typeToString(b)) {
                        return a
                    }
            }
            break
        case 'hole':
            return b
        case 'error':
            return a
        case 'inferred':
        case 'template':
        case 'return':
            return unreachable()
    }
    return { kind: 'error' }
}

const extractReturnType = (type: InferredType): InferredType | undefined => {
    switch (type.kind) {
        case 'inferred':
            unifyType(type)
            return extractReturnType(type)
        case 'inferred-fn':
            return type.returnType
        case 'return':
            return extractReturnType(type.type)
        case 'hole':
        case 'identifier':
        case 'error':
            return undefined
        case 'template':
            return unreachable()
    }
}
