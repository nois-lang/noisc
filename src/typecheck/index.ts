import { UnaryExpr } from '../ast/expr'
import { FieldAccessOp, MethodCallOp } from '../ast/op'
import { Name } from '../ast/operand'
import { Generic, Type } from '../ast/type'
import { Definition, defKey, idToString } from '../scope'
import { assert } from '../util/todo'

export type InferredType =
    | {
          kind: 'inferred'
          bounds: InferredType[]
      }
    | {
          kind: 'type-param'
          type: Generic
          unified?: InferredType
      }
    | {
          kind: 'inferred-fn'
          generics: InferredType[]
          params: InferredType[]
          returnType: InferredType
      }
    | { kind: 'field-access'; operandType: InferredType; fieldName: Name }
    | { kind: 'method-call'; operandType: InferredType; op: MethodCallOp }
    | { kind: 'def'; def: Definition }
    | Type
    | { kind: 'return'; type: InferredType }
    | ErrorType

export type ErrorTypeKind =
    | 'no-unify'
    | 'no-def'
    | 'no-field'
    | 'no-method'
    | 'not-callable'
    | 'unhandled'
    | 'other'
    | 'todo'

export type ErrorType = {
    kind: 'error'
    error: ErrorType_
}

/**
 * HACK: nested object to keep the same reference to an error, prevents duplicate error reports
 */
export type ErrorType_ = {
    errorKind: ErrorTypeKind
    message?: string
    reported: boolean
}

export const makeInferredType = (bounds: InferredType[] = []) => ({ kind: <const>'inferred', bounds })

export const makeTypeParam = (type: Generic) => ({ kind: <const>'type-param', type })

export const makeFieldAccessType = (expr: UnaryExpr) => ({
    kind: <const>'field-access',
    operandType: expr.operand.type!,
    fieldName: (<FieldAccessOp>expr.op).name
})

export const makeMethodCallType = (expr: UnaryExpr) => ({
    kind: <const>'method-call',
    operandType: expr.operand.type!,
    op: <MethodCallOp>expr.op
})

export const makeReturnType = (type: InferredType) => ({ kind: <const>'return', type })

export const makeDefType = (def: Definition) => ({ kind: <const>'def', def })

export const makeErrorType = (message?: string, errorKind: ErrorTypeKind = 'other') => ({
    kind: <const>'error',
    error: {
        errorKind,
        message,
        reported: false
    }
})

export const instantiateDefType = (t: InferredType): InferredType => {
    switch (t.kind) {
        case 'fn-type': {
            return makeInferredType([
                {
                    kind: 'inferred-fn',
                    generics: t.generics.map(g => {
                        assert(!!g.type)
                        return instantiateDefType(g.type!)
                    }),
                    params: t.paramTypes.map(pt => {
                        assert(!!pt.type)
                        return instantiateDefType(pt.type!)
                    }),
                    returnType: instantiateDefType(t.returnType.type!)
                }
            ])
        }
        case 'def': {
            return makeInferredType([t])
        }
        default:
            return t
    }
}

export const inferredTypeToString = (t: InferredType, depth = 0): string => {
    if (depth > 50) return '@rec'
    switch (t.kind) {
        case 'inferred':
            return `[${t.bounds.map(b => inferredTypeToString(b, depth + 1)).join(', ')}]`
        case 'type-param':
            const unified = t.unified ? `: ${inferredTypeToString(t.unified)}` : ''
            return `<${t.type.name.value}${unified}>`
        case 'inferred-fn':
            return `|${t.params.map(p => inferredTypeToString(p, depth + 1)).join(', ')}|: ${inferredTypeToString(
                t.returnType
            )}`
        case 'return':
            return `ret(${inferredTypeToString(t.type, depth + 1)})`
        case 'def':
            return `def(${t.def.kind} ${defKey(t.def)})`
        case 'field-access':
            return `(${inferredTypeToString(t.operandType)}).${t.fieldName.value}`
        case 'method-call':
            return `(${inferredTypeToString(t.operandType)}).${t.op.name.value}(${t.op.call.args
                .map(a => inferredTypeToString(a.type!))
                .join(', ')})`
        case 'identifier':
        case 'name':
        case 'fn-type':
        case 'hole':
            return typeToString(t)
        case 'error':
            const msg = t.error.message ? `(${t.error.message})` : ''
            return `error${msg}`
    }
}

export const typeToString = (t: Type): string => {
    switch (t.kind) {
        case 'identifier':
            return idToString(t)
        case 'fn-type':
            const main = `|${t.paramTypes.map(typeToString).join(', ')}|: ${typeToString(t.returnType)}`
            const typeArgs = t.generics.length > 0 ? `<${t.generics.map(g => g.name.value).join(', ')}>` : ''
            return typeArgs + main
        case 'hole':
            return '_'
        case 'name':
            return t.value
    }
}

export const addBounds = (type: InferredType, bounds: InferredType[]): void => {
    if (type.kind === 'inferred') {
        type.bounds.push(...bounds)
        return
    }
    assert(false, type.kind)
}

export const boundFromCall = (args: InferredType[]): InferredType => {
    return { kind: 'inferred-fn', generics: [], params: args, returnType: { kind: 'hole' } }
}
