import { Type } from '../ast/type'

export type InferredType = {
    kind: 'inferred'
    bounds: InferredType[]
    known?: Type
    unified?: Type
}

export const makeInferredType = (bounds: InferredType[] = []): InferredType => ({ kind: 'inferred', bounds })

export const makeKnownType = (known: Type): InferredType => ({ kind: 'inferred', bounds: [], known })
