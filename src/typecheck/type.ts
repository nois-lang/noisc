import { AnyType, UnknownType, VirtualGeneric, VidType } from './index'

export const anyType: AnyType = { kind: 'any-type' }

export const unknownType: UnknownType = { kind: 'unknown-type' }

export const selfType: VirtualGeneric = { kind: 'generic', name: 'Self', bounds: [] }

export const unitType: VidType = {
    kind: 'vid-type',
    identifier: { scope: ['std'], name: 'Unit' },
    typeArgs: []
}
