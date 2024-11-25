import { AstNode } from '../ast'
import { FieldPattern } from '../ast/match'
import { Identifier } from '../ast/operand'
import { FnType, Type, TypeParam } from '../ast/type'
import { Context, idToString } from '../scope'
import { assert, unreachable } from '../util/todo'

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
          kind: 'inferred-fn'
          typeParams: TypeParam[]
          params: InferredParamType[]
          returnType: InferredType
      }
    | { kind: 'field-pattern'; operandType: InferredType; fieldPattern: FieldPattern }
    | Type
    | { kind: 'return'; type: InferredType }
    | ErrorType

export type InferredParamType = {
    name?: string
    type: InferredType
}

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

export const makeInferredFnType = (t: FnType, ctx: Context) => {
    const updateTypeParamRef = (t: InferredType, from: TypeParam, to: TypeParam) => {
        switch (t.kind) {
            case 'identifier':
                if (t.def === from) {
                    t.def = to
                } else {
                    t.typeArgs.forEach(ta => updateTypeParamRef(ta, from, to))
                }
                break
            case 'inferred-fn':
                t.params.forEach(p => updateTypeParamRef(p.type, from, to))
                updateTypeParamRef(t.returnType, from, to)
                break
            case 'hole':
            case 'error':
                break
            default:
                unreachable(t.kind)
                break
        }
    }

    const typeParams = t.typeParams.map(tp => ({ ...tp }))

    const fnType: InferredType = {
        kind: <const>'inferred-fn',
        typeParams,
        params: t.params.map(pt => {
            assert(!!pt.type)
            return { name: pt.name?.value, type: instantiateType(pt.type!, ctx) }
        }),
        returnType: instantiateType(t.returnType ?? ctx.stdTypeIds.unit, ctx)
    }

    typeParams.forEach((tp, i) => {
        fnType.params.forEach(p => updateTypeParamRef(p.type, t.typeParams[i], tp))
        updateTypeParamRef(fnType.returnType, t.typeParams[i], tp)
    })

    return fnType
}

export const instantiateType = (t: InferredType, ctx: Context): InferredType => {
    switch (t.kind) {
        case 'fn-type': {
            return makeInferredFnType(t, ctx)
        }
        case 'identifier': {
            return { ...t, typeArgs: t.typeArgs.map(ta => instantiateType(ta, ctx) as Identifier) }
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
        case 'inferred-fn':
            const tps = t.typeParams.length > 0 ? `<${t.typeParams.map(typeParamToString)}>` : ''
            const pts = t.params
                .map(pt => `${pt.name ? `${pt.name}: ` : ''}${inferredTypeToString(pt.type)}`)
                .join(', ')
            return `inf-fn${tps}(${pts}): ${inferredTypeToString(t.returnType, depth + 1)}`
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
            const tps = t.typeParams.length > 0 ? `<${t.typeParams.map(typeParamToString)}>` : ''
            const pts = t.params
                .map(pt => `${pt.name ? `${pt.name.value}: ` : ''}${typeToString(pt.paramType)}`)
                .join(', ')
            return `fn${tps}(${pts}): ${typeToString(t.returnType)}`
        case 'hole':
            return '_'
        case 'name':
            return t.value
    }
}

export const typeParamToString = (tp: TypeParam): string => {
    const bounds = tp.bounds.length > 0 ? `: ${tp.bounds.map(b => typeToString(b)).join(' + ')}` : ''
    const unified = tp.unified ? ` (${inferredTypeToString(tp.unified)})` : ''
    return `${tp.name.value}${bounds}${unified}`
}

export const addBounds = (type: InferredType, bounds: InferredType[]): void => {
    if (type.kind === 'inferred') {
        type.bounds.push(...bounds)
        return
    }
    assert(false, `adding bounds to kind ${type.kind}`)
}

export const boundFromCall = (args: AstNode[]): InferredType => {
    return {
        kind: 'inferred-fn',
        typeParams: [],
        params: args.map(arg => {
            assert(!!arg.type)
            return { name: arg.kind === 'arg' ? arg.name?.value : undefined, type: arg.type! }
        }),
        returnType: { kind: 'hole' }
    }
}
