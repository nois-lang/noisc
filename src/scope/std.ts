import { VirtualType } from '../typecheck'
import { vidFromString } from './util'
import { VirtualIdentifier } from './vid'

export const defaultImportedVids: VirtualIdentifier[] = [
    'std::unit::Unit',
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

    'std::panic::todo',
    'std::panic::never',

    'std::math',
    'std::op',

    'std::io',
    'std::io::println',
    'std::option::Option',
    'std::into::Into'
].map(s => vidFromString(s))

export const bool: VirtualType = { kind: 'vid-type', identifier: { names: ['std', 'bool', 'Bool'] }, typeArgs: [] }
