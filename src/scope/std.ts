import { VidType } from '../typecheck'
import { unknownType } from '../typecheck/type'
import { vidFromString } from './util'

export const preludeVid = vidFromString('std::prelude')

export const bool: VidType = { kind: 'vid-type', identifier: vidFromString('std::bool::Bool'), typeArgs: [] }
export const iter: VidType = { kind: 'vid-type', identifier: vidFromString('std::iter::Iter'), typeArgs: [unknownType] }
export const iterable: VidType = {
    kind: 'vid-type',
    identifier: vidFromString('std::iter::Iterable'),
    typeArgs: [unknownType]
}
