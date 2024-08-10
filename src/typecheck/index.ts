import { Type } from '../ast/type'

export type InferredType = {
    kind: 'inferred'
    bounds: Type[]
    known?: Type
    unified?: Type
}

export const makeInferredType = (bounds: InferredType[] = []): InferredType => ({ kind: 'inferred', bounds })
