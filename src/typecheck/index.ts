import { Type } from '../ast/type'

export type InferredType = InferredTypeDef | { kind: 'ref'; ref: InferredType }

export type InferredTypeDef = {
    kind: 'inferred'
    known?: Type
    bounds: Type[]
    unified?: Type
}

export const makeInferredType = (bounds: Type[] = []): InferredType => ({ kind: 'inferred', bounds })

export const resolveTypeRef = (t: InferredType): InferredTypeDef => (t.kind === 'ref' ? resolveTypeRef(t.ref) : t)
