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
    'std::op::Add',
    'std::op::Sub',
    'std::op::Mult',
    'std::op::Div',

    'std::io',
    'std::io::println',
    'std::option::Option',
    'std::into::Into'
].map(s => vidFromString(s))
