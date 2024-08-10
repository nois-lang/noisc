import { Identifier } from '../ast/operand'
import { idFromString } from '../scope'

export const stringId: Identifier = idFromString('String')
export const charId: Identifier = idFromString('Char')
export const intId: Identifier = idFromString('Int')
export const floatId: Identifier = idFromString('Float')
export const boolId: Identifier = idFromString('Bool')
export const unitId: Identifier = idFromString('Unit')
