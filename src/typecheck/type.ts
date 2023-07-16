import { AnyType, UnknownType, VirtualGeneric, VirtualVariantType } from './index'

export const anyType: AnyType = { kind: 'any-type' }

export const unknownType: UnknownType = { kind: 'unknown-type' }

export const selfType: VirtualGeneric = { kind: 'generic', name: 'Self', bounds: [] }

export const unitType: VirtualVariantType = {
    kind: 'variant-type',
    identifier: { scope: ['std'], name: 'Unit' },
    typeParams: []
}
