import { Identifier } from '../ast/operand'
import { idFromString } from '../scope'

export const stringVid: Identifier = idFromString('std::string::String')
export const charVid: Identifier = idFromString('std::string::Char')
export const intVid: Identifier = idFromString('std::string::Int')
export const floatVid: Identifier = idFromString('std::string::Float')
export const boolVid: Identifier = idFromString('std::string::Bool')
export const unitVid: Identifier = idFromString('std::string::Unit')
