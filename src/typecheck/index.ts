import { Name } from '../ast/operand'
import { vidToString, VirtualIdentifier } from '../scope'

export interface Typed {
    type: VirtualType
}

export interface VirtualType {
    identifier: VirtualIdentifier
    typeParams: VirtualTypeParam[]
}

export type VirtualTypeParam = VirtualType | VirtualGeneric

export interface VirtualGeneric {
    name: Name
    bounds: VirtualType[]
}

/**
 * TODO: type params
 */
export const virtualTypeToString = (vt: VirtualType): string => vidToString(vt.identifier)
