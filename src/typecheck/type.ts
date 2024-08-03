import { Identifier } from '../ast/operand'
import { idFromString } from '../scope'

export const stringId: Identifier = idFromString('std::string::String')
export const charId: Identifier = idFromString('std::char::Char')
export const intId: Identifier = idFromString('std::int::Int')
export const floatId: Identifier = idFromString('std::float::Float')
export const boolId: Identifier = idFromString('std::bool::Bool')
export const unitId: Identifier = idFromString('std::unit::Unit')
