import { idFromString } from '.'
import { Identifier } from '../ast/operand'

export const preludeVid = idFromString('std::prelude')

// TODO: lack of std types must throw notFoundError
export const bool: Identifier = idFromString('std::bool::Bool')
export const string: Identifier = idFromString('std::string::String')
export const list: Identifier = idFromString('std::list::List')

export const show: Identifier = idFromString('std::io::show::Show')
export const trace: Identifier = idFromString('std::io::trace::Trace')

export const iter: Identifier = idFromString('std::iter::Iter')
export const iterable: Identifier = idFromString('std::iter::Iterable')
export const unwrap: Identifier = idFromString('std::unwrap::Unwrap')
export const future: Identifier = idFromString('std::future::Future')
