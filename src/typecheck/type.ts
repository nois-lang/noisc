import { makeDefType } from '.'
import { idFromString } from '../scope'

// TODO should reference type defs
export const stringType: ReturnType<typeof makeDefType> = makeDefType(idFromString('String'))
export const charType: ReturnType<typeof makeDefType> = makeDefType(idFromString('Char'))
export const intType: ReturnType<typeof makeDefType> = makeDefType(idFromString('Int'))
export const floatType: ReturnType<typeof makeDefType> = makeDefType(idFromString('Float'))
export const boolType: ReturnType<typeof makeDefType> = makeDefType(idFromString('Bool'))
export const unitType: ReturnType<typeof makeDefType> = makeDefType(idFromString('Unit'))
