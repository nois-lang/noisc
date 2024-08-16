import { Hole } from '../ast/match'
import { Identifier } from '../ast/operand'
import { Generic, Type } from '../ast/type'
import { idToString } from '../scope'
import { assert } from '../util/todo'

export type InferredType =
    | {
          kind: 'inferred'
          bounds: InferredType[]
      }
    | {
          kind: 'inferred-fn'
          generics: Generic[]
          params: InferredType[]
          returnType: InferredType
      }
    | { kind: 'template'; type: InferredType }
    | { kind: 'return'; type: InferredType }
    | Identifier
    | Hole
    | { kind: 'error' }

export const makeInferredType = (bounds: InferredType[] = []) => ({ kind: <const>'inferred', bounds })

export const makeReturnType = (type: InferredType) => ({ kind: <const>'return', type })

export const makeTemplateType = (type: InferredType) => ({ kind: <const>'template', type })

export const makeInferredFromType = (type: Type): InferredType => {
    switch (type.kind) {
        case 'identifier':
        case 'hole':
            return type
        case 'fn-type':
            return {
                kind: 'inferred-fn',
                generics: type.generics,
                params: type.paramTypes.map(makeInferredFromType),
                returnType: makeInferredFromType(type.returnType)
            }
    }
}

export const addBounds = (type: InferredType, bounds: InferredType[]): void => {
    if (type.kind === 'inferred') {
        type.bounds.push(...bounds)
        return
    }
    assert(false, type.kind)
}

export const instantiateTemplateType = (t: InferredType): InferredType => {
    if (t.kind === 'template') {
        return makeInferredType([structuredClone(t.type)])
    }
    return t
}

export const inferredTypeToString = (t: InferredType): string => {
    switch (t.kind) {
        case 'inferred':
            return `[${t.bounds.map(inferredTypeToString).join(', ')}]`
        case 'inferred-fn':
            return `|${t.params.map(inferredTypeToString).join(', ')}|: ${inferredTypeToString(t.returnType)}`
        case 'return':
            return `ret(${inferredTypeToString(t.type)})`
        case 'template':
            return `template(${inferredTypeToString(t.type)})`
        case 'hole':
        case 'identifier':
            return typeToString(t)
        case 'error':
            return 'ERROR'
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
    }
}
