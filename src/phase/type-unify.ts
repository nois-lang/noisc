import { AstNode } from '../ast'
import { Identifier } from '../ast/operand'
import { Context, addError } from '../scope'
import { typeError } from '../semantic/error'
import { ErrorType, InferredType, inferredTypeToString, makeErrorType } from '../typecheck'
import { dedup, zip } from '../util/array'
import { assign } from '../util/object'
import { assert, unreachable } from '../util/todo'

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
        case 'type-param': {
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
                case 'compose-op':
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
        case 'compose-op': {
            // TODO
            break
        }
    }
    if (node.type && report) {
        reportTypeErrors(ctx, node, node.type)
    }
}

export const unifyType = (type: InferredType, ctx: Context): void => {
    ctx.unifyStack.push(`unify ${inferredTypeToString(type)}`)
    switch (type.kind) {
        case 'inferred': {
            const unified = type.bounds.reduce((a, b) => unify(a, b, ctx), { kind: 'hole' })
            assign(type, unified)
            break
        }
        case 'inferred-fn':
            // TODO
            break
        case 'field-pattern': {
            unifyType(type.operandType, ctx)
            const variant = type.fieldPattern.variant
            if (!variant) {
                const e = makeErrorType(`no variant on type ${inferredTypeToString(type)}`, 'todo')
                assign(type, e)
                break
            }
            const typeDefs = extractIds(type.operandType)
                .filter(t => t.def?.kind === 'type-def')
                .map(id => id.def)
                .filter(def => def?.kind === 'type-def')
            if (typeDefs.length > 1) {
                // TODO
                assign(type, makeErrorType('multiple defs', 'todo'))
                break
            }
            if (typeDefs.length === 0) {
                assign(type, makeErrorType(`no def ${inferredTypeToString(type)}`, 'todo'))
                break
            }
            const typeDef = typeDefs[0]
            if (typeDef !== variant.typeDef) {
                // failed unify
                break
            }
            const f = variant.fields.find(fd => fd.name.value === type.fieldPattern.name.value)
            if (!f) {
                assign(type, makeErrorType(type.fieldPattern.name.value, 'no-field'))
                break
            }
            // TODO: handle type-def generics
            assert(!!f.type, `field has no type: ${typeDef.name.value}.${f.name.value}`)
            assign(type, f.type!)
            unifyType(type, ctx)
            break
        }
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
            if (type.def?.type?.kind === 'type-param') {
                assign(type, type.def.type)
                break
            }
            break
        case 'fn-type':
        case 'name':
        case 'type-param':
        case 'hole':
        case 'error':
            break
    }
    ctx.unifyStack.pop()
}

export const unify = (a: InferredType, b: InferredType, ctx: Context): InferredType => {
    ctx.unifyStack.push(`unify [${inferredTypeToString(a)}, ${inferredTypeToString(b)}]`)
    unifyType(a, ctx)
    unifyType(b, ctx)
    ctx.unifyStack.push(`unify [${inferredTypeToString(a)}, ${inferredTypeToString(b)}]`)
    let res = unify_(a, b, ctx)
    if (res.kind === 'error' && res.error.errorKind === 'unhandled') {
        res = unify_(b, a, ctx)
    }
    if (res.kind === 'error') {
        res.error.stack = dedup([...ctx.unifyStack])
    }
    ctx.unifyStack.pop()
    ctx.unifyStack.pop()
    return res
}

const unify_ = (a: InferredType, b: InferredType, ctx: Context): InferredType => {
    if (a === b) return a
    if (b.kind === 'inferred') {
        unreachable(inferredTypeToString(b))
    }
    switch (a.kind) {
        case 'inferred-fn': {
            switch (b.kind) {
                case 'inferred-fn': {
                    const t: InferredType = {
                        kind: 'inferred-fn',
                        // TODO
                        typeParams: [],
                        params: zip(a.params, b.params, (a_, b_) => unify(a_, b_, ctx)),
                        returnType: unify(a.returnType, b.returnType, ctx)
                    }
                    return t
                }
                case 'fn-type': {
                    const t: InferredType = {
                        kind: 'inferred-fn',
                        // TODO
                        typeParams: [],
                        params: zip(a.params, b.paramTypes, (a_, b_) => unify(a_, b_.type!, ctx)),
                        returnType: unify(a.returnType, b.returnType, ctx)
                    }
                    return t
                }
            }
            break
        }
        case 'identifier': {
            if (a.def === ctx.stdTypeIds.never?.def) {
                return b
            }
            switch (b.kind) {
                // biome-ignore lint:
                case 'identifier': {
                    if (a.def && a.def === b.def) {
                        if (a.typeArgs.length === b.typeArgs.length) {
                            const typeArgs = <Identifier[]>zip(a.typeArgs, b.typeArgs, (ta, tb) => unify(ta, tb, ctx))
                            const u: Identifier = {
                                kind: 'identifier',
                                parseNode: a.parseNode,
                                names: a.names,
                                typeArgs,
                                def: a.def
                            }
                            assign(a, u)
                            assign(b, u)
                            return u
                        }
                    }
                }
                case 'inferred-fn':
                case 'fn-type':
                case 'name':
                    const e = makeErrorType(`failed unify [${[a, b].map(inferredTypeToString).join(', ')}]`, 'no-unify')
                    assign(a, e)
                    assign(b, e)
                    return a
                case 'type-param':
                    break
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
                const u = unify(a.unified, b, ctx)
                assign(a.unified, u)
                return u
            }
            if (b.kind !== 'hole') {
                // TODO: unify with type bounds
                a.unified = b
            }
            return b
        }
        case 'hole':
            return b
        case 'error':
            return a
        case 'fn-type':
            break
        case 'inferred':
        case 'return':
        case 'name':
            // these should never appear in a result of `unifyType`
            return unreachable(a.kind)
    }
    return makeErrorType(`unify [${[inferredTypeToString(a), inferredTypeToString(b)].join(', ')}]`, 'unhandled')
}

const extractReturnType = (type: InferredType, ctx: Context): InferredType | undefined => {
    switch (type.kind) {
        case 'inferred':
        case 'field-pattern':
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
            return undefined
        case 'error':
            return type
        case 'fn-type':
            return type.returnType
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

/**
 * TODO: better name
 */
const extractIds = (t: InferredType): Identifier[] => {
    switch (t.kind) {
        case 'identifier':
            if (t.def) {
                return [t]
            }
            break
        case 'type-param':
            return t.type.bounds
    }
    return []
}
