import { AstNode } from '../ast'
import { addError, Context, idToString } from '../scope'
import { typeError } from '../semantic/error'
import { InferredType, inferredTypeToString, makeDefType, makeErrorType } from '../typecheck'
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
    if (node.type) {
        if (node.type.kind === 'error') {
            addError(ctx, typeError(ctx, node, node.type.message ?? 'type error'))
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
        case 'field-access':
            unifyType(type.operandType)
            if (type.operandType.kind === 'def' && type.operandType.def?.kind === 'type-def') {
                const typeDef = type.operandType.def
                if (typeDef.variants.length > 1) {
                    // TODO
                    break
                }
                const f = typeDef.variants[0].fieldDefs.find(f => f.name.value === type.fieldName.value)
                if (!f) {
                    // TODO
                    break
                }
                // TODO: handle type-def generics
                Object.assign(type, f.type!)
                break
            }
            Object.assign(type, makeErrorType(inferredTypeToString(type)))
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
        case 'identifier':
            Object.assign(type, type.def ? makeDefType(type.def) : makeErrorType(`no def: ${idToString(type)}`))
            break
        case 'fn-type':
            // TODO: should be unreachable
            break
        case 'name':
        case 'type-param':
        case 'hole':
        case 'def':
        case 'error':
            break
    }
}

const unify = (a: InferredType, b: InferredType): InferredType => {
    const u1 = unify_(a, b)
    if (u1.kind !== 'error') {
        return u1
    }
    const u2 = unify_(b, a)
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
                case 'def':
                case 'hole':
                case 'error':
                    todo(b.kind)
                    break
                case 'inferred':
                case 'return':
                    unreachable()
                    break
            }
            break
        case 'def':
            switch (b.kind) {
                case 'def':
                    // TODO: proper equality
                    if (a.def === b.def) {
                        return a
                    } else {
                        const e = {
                            kind: 'error',
                            message: `failed unify [${[inferredTypeToString(a), inferredTypeToString(b)].join(', ')}]`
                        }
                        Object.assign(a, e)
                        Object.assign(b, e)
                    }
                    break
                case 'inferred':
                case 'inferred-fn':
                case 'return':
                    todo(b.kind)
                    break
            }
            break
        case 'type-param':
            if (a.unified) {
                const u = unify(a.unified, b)
                Object.assign(a.unified, u)
                return u
            }
            if (b.kind !== 'hole') {
                a.unified = b
            }
            return b
        case 'identifier':
        case 'fn-type':
        case 'name':
            // TODO
            break
        case 'hole':
            return b
        case 'error':
            return a
        case 'inferred':
        case 'field-access':
        case 'return':
            // these should never appear in a result of `unifyType`
            return unreachable()
    }
    return {
        kind: 'error',
        message: `unhandled unify [${[inferredTypeToString(a), inferredTypeToString(b)].join(', ')}]`
    }
}

const extractReturnType = (type: InferredType): InferredType | undefined => {
    switch (type.kind) {
        case 'inferred':
        case 'field-access':
            unifyType(type)
            return extractReturnType(type)
        case 'type-param':
            if (type.unified) {
                return extractReturnType(type.unified)
            }
            return undefined
        case 'inferred-fn':
            return type.returnType
        case 'return':
            return extractReturnType(type.type)
        case 'identifier':
        case 'name':
        case 'hole':
        case 'error':
            return undefined
        case 'def':
            if (type.def.kind === 'fn-def') {
                unreachable()
                return type.def.returnType!
            }
            return undefined
        case 'fn-type':
            return unreachable()
    }
}
