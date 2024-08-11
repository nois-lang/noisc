import { Type } from '../ast/type'
import { assert } from '../util/todo'

export type InferredType =
    | {
          kind: 'inferred'
          bounds: Type[]
          unified?: Type
      }
    | { kind: 'return'; type: Type }

export const makeInferredType = (bounds: Type[] = []) => ({ kind: <const>'inferred', bounds })

export const makeReturnType = (type: Type) => ({ kind: <const>'return', type })

export const addBounds = (type: Type, bounds: Type[]): void => {
    if (type.kind === 'inferred') {
        type.bounds.push(...bounds)
        return
    }
    assert(false, type.kind)
}
