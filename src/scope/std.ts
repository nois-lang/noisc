import { VidType } from '../typecheck'
import { unknownType } from '../typecheck/type'
import { vidFromString } from './util'
import { VirtualIdentifier } from './vid'

export const defaultImportedVids: VirtualIdentifier[] = [
    'std::unit::Unit',
    'std::unit::unit',

    'std::never::Never',

    'std::num::Num',

    'std::float::Float',

    'std::int::Int',

    'std::string::String',

    'std::char::Char',

    'std::bool::Bool',
    'std::bool::true',
    'std::bool::false',

    'std::list::List',

    'std::never::Never',

    'std::panic::todo',
    'std::panic::never',

    'std::math',
    'std::op',

    'std::io',
    'std::io::println',
    'std::option::Option',
    'std::into::Into'
].map(s => vidFromString(s))

export const bool: VidType = { kind: 'vid-type', identifier: vidFromString('std::bool::Bool'), typeArgs: [] }
export const iter: VidType = { kind: 'vid-type', identifier: vidFromString('std::iter::Iter'), typeArgs: [unknownType] }
export const iterable: VidType = {
    kind: 'vid-type',
    identifier: vidFromString('std::iter::Iterable'),
    typeArgs: [unknownType]
}
