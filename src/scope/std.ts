import { VidType } from '../typecheck'
import { holeType, unknownType } from '../typecheck/type'
import { vidFromString } from './util'

export const preludeVid = vidFromString('std::prelude')

export const bool: VidType = { kind: 'vid-type', identifier: vidFromString('std::bool::Bool'), typeArgs: [] }
export const string: VidType = { kind: 'vid-type', identifier: vidFromString('std::string::String'), typeArgs: [] }

export const show: VidType = { kind: 'vid-type', identifier: vidFromString('std::io::show::Show'), typeArgs: [] }
export const trace: VidType = { kind: 'vid-type', identifier: vidFromString('std::io::trace::Trace'), typeArgs: [] }

export const iter: VidType = { kind: 'vid-type', identifier: vidFromString('std::iter::Iter'), typeArgs: [unknownType] }
export const iterable: VidType = {
    kind: 'vid-type',
    identifier: vidFromString('std::iter::Iterable'),
    typeArgs: [holeType]
}
export const unwrap: VidType = {
    kind: 'vid-type',
    identifier: vidFromString('std::unwrap::Unwrap'),
    typeArgs: [holeType]
}
