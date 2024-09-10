import { AstNode } from '../ast'
import { Identifier } from '../ast/operand'
import { Context, addError } from '../scope'
import { typeError } from '../semantic/error'
import { findMethodDefForMethodCall } from '../semantic/impl'
import {
    ErrorType,
    InferredType,
    addBounds,
    boundFromCall,
    inferredTypeToString,
    instantiateDefType,
    makeErrorType,
    makeInferredType,
    makeReturnType
} from '../typecheck'
import { zip } from '../util/array'
import { assign } from '../util/object'
import { todo, unreachable } from '../util/todo'

/**
 * Unify type bounds
 */
export const unifyTypeBounds = (node: AstNode, ctx: Context, report = true): void => {
    if (node.type) {
        unifyType(node.type, ctx)
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
            unifyTypeBounds(node.operand, ctx, false)
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
            if (node.block) {
                unifyTypeBounds(node.block, ctx)
            }
            break
        }
        case 'trait-def':
        case 'impl-def': {
            node.block.statements.forEach(s => unifyTypeBounds(s, ctx))
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
    if (node.type && report) {
        reportTypeErrors(ctx, node, node.type)
    }
}

export const unifyType = (type: InferredType, ctx: Context): void => {
    switch (type.kind) {
        case 'inferred': {
            const unified = type.bounds.reduce((a, b) => unify(a, b, ctx), { kind: 'hole' })
            assign(type, unified)
            break
        }
        case 'inferred-fn':
            // TODO
            break
        case 'field-access':
            unifyType(type.operandType, ctx)
            if (type.operandType.kind === 'def') {
                if (type.operandType.def?.kind !== 'type-def') {
                    unreachable()
                    break
                }
                const typeDef = type.operandType.def
                if (typeDef.variants.length > 1) {
                    // TODO: make sure every variant contains such field with equal type
                    assign(type, makeErrorType('variant field access', 'todo'))
                    break
                }
                const f = typeDef.variants[0].fieldDefs.find(f => f.name.value === type.fieldName.value)
                if (!f) {
                    // TODO: might be a method reference
                    assign(type, makeErrorType(type.fieldName.value, 'no-field'))
                    break
                }
                // TODO: handle type-def generics
                assign(type, f.type!)
                break
            }
            assign(type, makeErrorType(inferredTypeToString(type)))
            break
        case 'method-call':
            unifyType(type.operandType, ctx)
            if (type.operandType.kind === 'def') {
                if (type.operandType.def?.kind === 'type-def') {
                    const notFoundError = makeErrorType(
                        `method ${type.op.name.value} not found in type ${inferredTypeToString(type.operandType)}`,
                        'no-method'
                    )
                    const typeDef = type.operandType.def
                    const m = typeDef.impl?.block.statements.find(
                        s => s.kind === 'fn-def' && s.name.value === type.op.name.value
                    )
                    if (!m) {
                        // TODO: check traits impld by operandType
                        const fnDef = findMethodDefForMethodCall(type, ctx)
                        if (!fnDef) {
                            assign(type, notFoundError)
                            break
                        }
                        assign(
                            type,
                            makeReturnType(
                                makeInferredType([
                                    instantiateDefType(fnDef.type!),
                                    boundFromCall(type.op.call.args.map(a => a.type!))
                                ])
                            )
                        )
                        unifyType(type, ctx)
                        break
                    }
                    const mType = instantiateDefType(m.type!)
                    addBounds(mType, [boundFromCall(type.op.call.args.map(a => a.type!))])
                    assign(type, makeReturnType(mType))
                    unifyType(type, ctx)
                    break
                }
                if (type.operandType.def?.kind === 'trait-def') {
                    // TODO
                    assign(type, makeErrorType('method call on trait', 'todo'))
                    break
                }
            }
            assign(type, makeErrorType(`not def ${inferredTypeToString(type.operandType)}`))
            break
        case 'return': {
            unifyType(type.type, ctx)
            const ret = extractReturnType(type.type, ctx)
            if (!ret) {
                const e = makeErrorType(`type ${inferredTypeToString(type.type)} is not callable`, 'not-callable')
                assign(type, e)
                break
            }
            assign(type, ret)
            unifyType(type, ctx)
            break
        }
        case 'identifier':
            if (type.def?.type && type.typeArgs.length === 0) {
                type.typeArgs.forEach(ta => unifyType(ta, ctx))
                assign(type, type.def.type)
                break
            }
            break
        case 'fn-type':
        case 'name':
        case 'type-param':
        case 'hole':
        case 'def':
        case 'error':
            break
    }
}

export const unify = (a: InferredType, b: InferredType, ctx: Context, stack: [string, string][] = []): InferredType => {
    stack.push([inferredTypeToString(a), inferredTypeToString(b)])
    let res = unify_(a, b, ctx, stack)
    if (res.kind === 'error' && res.error.errorKind === 'unhandled') {
        res = unify_(b, a, ctx, stack)
    }
    if (res.kind === 'error') {
        res.error.stack = [...stack]
    }
    stack.pop()
    return res
}

const unify_ = (a: InferredType, b: InferredType, ctx: Context, stack: [string, string][]): InferredType => {
    unifyType(a, ctx)
    unifyType(b, ctx)
    if (a === b) return a
    if (b.kind === 'inferred' || b.kind === 'fn-type') {
        unreachable(inferredTypeToString(b))
    }
    switch (a.kind) {
        case 'inferred-fn': {
            switch (b.kind) {
                case 'inferred-fn':
                    const t: InferredType = {
                        kind: 'inferred-fn',
                        // TODO
                        generics: [],
                        params: zip(a.params, b.params, (a_, b_) => unify(a_, b_, ctx, stack)),
                        returnType: unify(a.returnType, b.returnType, ctx, stack)
                    }
                    return t
            }
            break
        }
        case 'def': {
            switch (b.kind) {
                case 'type-param':
                    break
                // biome-ignore lint:
                case 'def':
                    // TODO: respect def's trait impls
                    if (b.kind === 'def' && a.def === b.def) {
                        return a
                    }
                case 'inferred-fn':
                case 'identifier':
                case 'fn-type':
                case 'name':
                    const e = makeErrorType(
                        `failed unify [${[inferredTypeToString(a), inferredTypeToString(b)].join(', ')}]`,
                        'no-unify'
                    )
                    assign(a, e)
                    assign(b, e)
                    return a
            }
            break
        }
        case 'type-param': {
            // HACK to unify method signatures unify(traitMethod.type, implMethod.type)
            if (b.kind === 'type-param' && a.type.name.value === b.type.name.value) {
                assign(b, a)
                return a
            }
            if (a.unified) {
                const u = unify(a.unified, b, ctx, stack)
                assign(a.unified, u)
                return u
            }
            if (b.kind !== 'hole') {
                a.unified = b
            }
            return b
        }
        case 'name':
            break
        case 'identifier':
            if (b.kind === 'identifier') {
                if (b.def?.type?.kind === 'type-param') {
                    return unify(b.def.type, a, ctx, stack)
                }
                if (a.def && a.def === b.def) {
                    if (a.typeArgs.length !== b.typeArgs.length) {
                        todo()
                        break
                    }
                    const typeArgs = <Identifier[]>zip(a.typeArgs, b.typeArgs, (ta, tb) => unify(ta, tb, ctx, stack))
                    const u: Identifier = { kind: 'identifier', parseNode: a.parseNode, names: a.names, typeArgs }
                    assign(a, u)
                    assign(b, u)
                    return u
                }
            }
            break
        case 'hole':
            return b
        case 'error':
            return a
        case 'fn-type':
        case 'inferred':
        case 'field-access':
        case 'return':
            // these should never appear in a result of `unifyType`
            return unreachable()
    }
    return makeErrorType(
        `unhandled unify [${a.kind}, ${b.kind}] [${[inferredTypeToString(a), inferredTypeToString(b)].join(', ')}]`,
        'unhandled'
    )
}

const extractReturnType = (type: InferredType, ctx: Context): InferredType | undefined => {
    switch (type.kind) {
        case 'inferred':
        case 'field-access':
            unifyType(type, ctx)
            return extractReturnType(type, ctx)
        case 'type-param':
            if (type.unified) {
                return extractReturnType(type.unified, ctx)
            }
            return undefined
        case 'inferred-fn':
            return type.returnType
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
        case 'method-call':
        case 'fn-type':
        case 'return':
            return unreachable(type.kind)
    }
}

export const reportTypeErrors = (ctx: Context, node: AstNode, type: InferredType): void => {
    if (type) {
        findTypeErrors(type).forEach(e => {
            if (e.error.reported) return
            addError(ctx, typeError(ctx, node, e.error))
            e.error.reported = true
        })
    }
}

export const findTypeErrors = (t: InferredType): ErrorType[] => {
    switch (t.kind) {
        case 'inferred-fn':
            return [...t.params.flatMap(findTypeErrors), ...findTypeErrors(t.returnType)]
        case 'error':
            return [t]
    }
    return []
}
