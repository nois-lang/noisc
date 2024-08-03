import { Type } from '../ast/type'

export type InferredType = {
    kind: 'inferred'
    known?: Type
    bounds: InferredType[]
    unified?: Type
}

export const makeInferredType = (bounds: InferredType[] = []): InferredType => ({ kind: 'inferred', bounds })
