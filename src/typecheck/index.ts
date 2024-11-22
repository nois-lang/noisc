import { FieldPattern } from '../ast/match'
import { FnType, Type, TypeParam } from '../ast/type'
import { Context, idToString } from '../scope'
import { assert } from '../util/todo'

/**
 * TODO: attach "source" node to a type to indicate where this type is coming from
 * set it for literals and explicit typings
 */
export type InferredType =
    | {
          kind: 'inferred'
          bounds: InferredType[]
      }
    | {
          kind: 'type-param'
          type: TypeParam
          unified?: InferredType
      }
    | {
          kind: 'inferred-fn'
          typeParams: InferredType[]
          params: InferredType[]
          returnType: InferredType
      }
    | { kind: 'field-pattern'; operandType: InferredType; fieldPattern: FieldPattern }
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
    stack?: string[]
}

export const makeInferredType = (bounds: InferredType[] = []) => ({ kind: <const>'inferred', bounds })

export const makeTypeParam = (type: TypeParam) => ({ kind: <const>'type-param', type })

export const makeFieldPatternType = (operandType: InferredType, fieldPattern: FieldPattern) => ({
    kind: <const>'field-pattern',
    operandType,
    fieldPattern
})

export const makeReturnType = (type: InferredType) => ({ kind: <const>'return', type })

export const makeErrorType = (message?: string, errorKind: ErrorTypeKind = 'other') => ({
    kind: <const>'error',
    error: {
        errorKind,
        message,
        reported: false
    }
})

export const instantiateType = <T extends InferredType>(t: T, ctx: Context): T => {
    switch (t.kind) {
        case 'fn-type': {
            const inst: FnType = {
                kind: 'fn-type',
                typeParams: t.typeParams.map(tp => ({ ...tp })),
                paramTypes: t.paramTypes.map(pt => {
                    assert(!!pt.type)
                    return { ...pt, type: instantiateType(pt.type!, ctx) }
                }),
                returnType: instantiateType(t.returnType ?? ctx.stdTypeIds.unit, ctx)
            }
            return inst as any
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
            const unified = t.unified ? ` (${inferredTypeToString(t.unified, depth + 1)})` : ''
            const bounds =
                t.type.bounds.length > 0
                    ? `: ${t.type.bounds.map(b => inferredTypeToString(b, depth + 1)).join('+')}`
                    : ''
            return `<${t.type.name.value}${bounds}${unified}>`
        case 'inferred-fn':
            return `|${t.params.map(p => inferredTypeToString(p, depth + 1)).join(', ')}|: ${inferredTypeToString(
                t.returnType,
                depth + 1
            )}`
        case 'return':
            return `ret(${inferredTypeToString(t.type, depth + 1)})`
        case 'field-pattern':
            return `dest(${inferredTypeToString(t.operandType)}, ${t.fieldPattern.variant?.name.value ?? '_'}(${
                t.fieldPattern.name.value
            }))`
        case 'identifier':
        case 'name':
        case 'fn-type':
        case 'hole':
            return typeToString(t)
        case 'error':
            const msg = t.error.message ? `, ${t.error.message}` : ''
            return `error(${t.error.errorKind}${msg})`
    }
}

export const typeToString = (t: Type): string => {
    switch (t.kind) {
        case 'identifier':
            return idToString(t)
        case 'fn-type':
            const main = `fn(${t.paramTypes
                .map(pt => (pt.name ? `${pt.name.value}: ` : '') + typeToString(pt.paramType))
                .join(', ')}): ${typeToString(t.returnType)}`
            const typeArgs = t.typeParams.length > 0 ? `<${t.typeParams.map(g => g.name.value).join(', ')}>` : ''
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
    assert(false, `adding bounds to kind ${type.kind}`)
}

export const boundFromCall = (args: InferredType[]): InferredType => {
    return { kind: 'inferred-fn', typeParams: [], params: args, returnType: { kind: 'hole' } }
}
