import { Name } from '../ast/operand'
import { Type } from '../ast/type'
import { idToString } from '../scope'
import { assert } from '../util/todo'

export type InferredType =
    | {
          kind: 'inferred'
          bounds: InferredType[]
      }
    | {
          kind: 'type-param'
          name: Name
          unified?: InferredType
      }
    | {
          kind: 'inferred-fn'
          generics: InferredType[]
          params: InferredType[]
          returnType: InferredType
      }
    | { kind: 'def'; type: Type }
    | { kind: 'hole' }
    | { kind: 'return'; type: InferredType }
    | { kind: 'error'; message?: string }

export const makeInferredType = (bounds: InferredType[] = []) => ({ kind: <const>'inferred', bounds })

export const makeTypeParam = (name: Name) => ({ kind: <const>'type-param', name })

export const makeReturnType = (type: InferredType) => ({ kind: <const>'return', type })

export const makeDefType = (type: Type) => ({ kind: <const>'def', type })

export const addBounds = (type: InferredType, bounds: InferredType[]): void => {
    if (type.kind === 'inferred') {
        type.bounds.push(...bounds)
        return
    }
    assert(false, type.kind)
}

export const instantiateDefType = (t: InferredType): InferredType => {
    if (t.kind === 'def') {
        if (t.type.kind === 'fn-type') {
            assert(!!t.type.returnType.type)
            return makeInferredType([
                {
                    kind: 'inferred-fn',
                    generics: t.type.generics.map(g => {
                        assert(!!g.type)
                        return instantiateDefType(g.type!)
                    }),
                    params: t.type.paramTypes.map(pt => {
                        assert(!!pt.type)
                        return instantiateDefType(pt.type!)
                    }),
                    returnType: instantiateDefType(t.type.returnType.type!)
                }
            ])
        }
        return makeInferredType([t])
    }
    return t
}

export const inferredTypeToString = (t: InferredType, depth = 0): string => {
    if (depth > 5) return '@rec'
    switch (t.kind) {
        case 'inferred':
            return `[${t.bounds.map(b => inferredTypeToString(b, depth + 1)).join(', ')}]`
        case 'type-param':
            const unified = t.unified ? `: ${inferredTypeToString(t.unified)}` : ''
            return `<${t.name.value}${unified}>`
        case 'inferred-fn':
            return `|${t.params.map(p => inferredTypeToString(p, depth + 1)).join(', ')}|: ${inferredTypeToString(
                t.returnType
            )}`
        case 'return':
            return `ret(${inferredTypeToString(t.type, depth + 1)})`
        case 'def':
            return `def(${typeToString(t.type)})`
        case 'hole':
            return '_'
        case 'error':
            const msg = t.message ? `(${t.message})` : ''
            return `ERROR${msg}`
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
