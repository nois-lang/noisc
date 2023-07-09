import { vidFromString, VirtualIdentifier } from './vid'

export const defaultImportedVids = (): VirtualIdentifier[] => [
    'std::unit::Unit',
    'std::num::Num',
    'std::float::Float',
    'std::int::Int',
    'std::string::String',
    'std::list::List',
    'std::math',
    'std::op::Add',
    'std::op::Sub',
    'std::op::Mult',
    'std::op::Div',
    'std::io::println',
].map(s => vidFromString(s))
