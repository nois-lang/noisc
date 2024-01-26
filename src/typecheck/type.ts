import { HoleType, UnknownType, VidType, VirtualGeneric } from './index'

export const unknownType: UnknownType = { kind: 'unknown-type' }

export const holeType: HoleType = { kind: 'hole-type' }

export const selfType: VirtualGeneric = { kind: 'generic', name: 'Self', bounds: [] }

export const unitType: VidType = {
    kind: 'vid-type',
    identifier: { names: ['std', 'unit', 'Unit'] },
    typeArgs: []
}

export const neverType: VidType = {
    kind: 'vid-type',
    identifier: { names: ['std', 'never', 'Never'] },
    typeArgs: []
}
