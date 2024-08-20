import { makeDefType } from '.'

// TODO should reference type defs
export const stringType = makeDefType({ kind: 'name', value: 'String' })
export const charType = makeDefType({ kind: 'name', value: 'Char' })
export const intType = makeDefType({ kind: 'name', value: 'Int' })
export const floatType = makeDefType({ kind: 'name', value: 'Float' })
export const boolType = makeDefType({ kind: 'name', value: 'Bool' })
export const unitType = makeDefType({ kind: 'name', value: 'Unit' })
