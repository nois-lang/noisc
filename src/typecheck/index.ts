import { Type } from '../ast/type'
import { idToString } from '../scope'
import { assert } from '../util/todo'

export type InferredType =
    | {
          kind: 'inferred'
          bounds: Type[]
          unified?: Type
      }
    | { kind: 'const'; type: Type }
    | { kind: 'return'; type: Type }

export const makeInferredType = (bounds: Type[] = []) => ({ kind: <const>'inferred', bounds })

export const makeReturnType = (type: Type) => ({ kind: <const>'return', type })

export const makeConstType = (type: Type) => ({ kind: <const>'const', type })

export const addBounds = (type: Type, bounds: Type[]): void => {
    if (type.kind === 'inferred') {
        type.bounds.push(...bounds)
        return
    }
    assert(false, type.kind)
}

export const cloneType = (t: InferredType): InferredType => {
    switch (t.kind) {
        case 'inferred':
            return {
                kind: 'inferred',
                bounds: t.bounds.map(t_ => (t_.kind === 'inferred' || t_.kind === 'return' ? cloneType(t_) : t_))
            }
        case 'const':
        case 'return':
            return { kind: t.kind, type: t.type }
    }
}

export const inferredTypeToString = (t: InferredType): string => {
    switch (t.kind) {
        case 'inferred':
            if (t.unified) {
                return typeToString(t.unified)
            }
            return t.bounds.length > 0 ? `[${t.bounds.map(typeToString).join(', ')}]` : '_'

        case 'return':
            return `ret(${typeToString(t.type)})`
        case 'const':
            return typeToString(t.type)
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
        case 'inferred':
        case 'const':
        case 'return':
            return inferredTypeToString(t)
    }
}
