import { VidType } from '../typecheck'
import { holeType, unknownType } from '../typecheck/type'
import { vidFromString } from './util'

export const preludeVid = vidFromString('std::prelude')

// TODO: lack of std types must throw notFoundError
export const bool: VidType = { kind: 'vid-type', identifier: vidFromString('std::bool::Bool'), typeArgs: [] }
export const string: VidType = { kind: 'vid-type', identifier: vidFromString('std::string::String'), typeArgs: [] }
export const list: VidType = { kind: 'vid-type', identifier: vidFromString('std::list::List'), typeArgs: [holeType] }

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
export const future: VidType = {
    kind: 'vid-type',
    identifier: vidFromString('std::future::Future'),
    typeArgs: [holeType]
}
