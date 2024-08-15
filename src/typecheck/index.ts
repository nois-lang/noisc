import { Hole } from '../ast/match'
import { Generic, Type } from '../ast/type'
import { idToString } from '../scope'
import { assert } from '../util/todo'

export type InferredType =
    | {
          kind: 'inferred'
          bounds: InferredType[]
          unified?: Type
      }
    | {
          kind: 'inferred-fn'
          generics: Generic[]
          params: InferredType[]
          returnType: InferredType
          unified?: Type
      }
    | { kind: 'const'; type: Type }
    | { kind: 'return'; type: InferredType }
    | Hole

export const makeInferredType = (bounds: InferredType[] = []) => ({ kind: <const>'inferred', bounds })

export const makeReturnType = (type: InferredType) => ({ kind: <const>'return', type })

export const makeConstType = (type: Type) => ({ kind: <const>'const', type })

export const addBounds = (type: InferredType, bounds: InferredType[]): void => {
    if (type.kind === 'inferred') {
        type.bounds.push(...bounds)
        return
    }
    assert(false, type.kind)
}

export const instantiateConstType = (t: InferredType): InferredType => {
    switch (t.kind) {
        case 'const':
            return makeInferredType([t])
        default:
            return t
    }
}

export const inferredTypeToString = (t: InferredType): string => {
    switch (t.kind) {
        case 'inferred':
            if (t.unified) {
                return typeToString(t.unified)
            }
            return `[${t.bounds.map(inferredTypeToString).join(', ')}]`
        case 'inferred-fn':
            return `|${t.params.map(inferredTypeToString).join(', ')}|: ${inferredTypeToString(t.returnType)}`
        case 'return':
            return `ret(${inferredTypeToString(t.type)})`
        case 'const':
            return typeToString(t.type)
        case 'hole':
            return typeToString(t)
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
