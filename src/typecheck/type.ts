import { InferredType } from '.'
import { idFromString } from '../scope'

export const stringType: InferredType = { kind: 'template', type: idFromString('String') }
export const charType: InferredType = { kind: 'template', type: idFromString('Char') }
export const intType: InferredType = { kind: 'template', type: idFromString('Int') }
export const floatType: InferredType = { kind: 'template', type: idFromString('Float') }
export const boolType: InferredType = { kind: 'template', type: idFromString('Bool') }
export const unitType: InferredType = { kind: 'template', type: idFromString('Unit') }
