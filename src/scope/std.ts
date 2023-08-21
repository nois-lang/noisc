import { vidFromString } from './util'
import { VirtualIdentifier } from './vid'

export const defaultImportedVids = (): VirtualIdentifier[] => [
    'std::unit::Unit',
    'std::num::Num',
    'std::float::Float',
    'std::int::Int',
    'std::string::String',
    'std::char::Char',
    'std::list::List',
    'std::math',
    'std::op::Add',
    'std::op::Sub',
    'std::op::Mult',
    'std::op::Div',
    'std::io',
    'std::io::println',
].map(s => vidFromString(s))
