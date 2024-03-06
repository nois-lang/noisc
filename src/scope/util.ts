import { Identifier } from '../ast/operand'
import { VirtualIdentifier } from './vid'

export const vidFromString = (str: string): VirtualIdentifier => ({ names: str.split('::') })

export const vidToString = (vid: VirtualIdentifier): string => vid.names.join('::')

export const vidEq = (a: VirtualIdentifier, b: VirtualIdentifier): boolean => {
    if (a.names.length !== b.names.length) return false
    for (let i = 0; i < a.names.length; i++) {
        if (a.names[i] !== b.names[i]) return false
    }
    return true
}

export const vidFromScope = (vid: VirtualIdentifier): VirtualIdentifier => ({ names: vid.names.slice(0, -1) })

export const idToVid = (id: Identifier): VirtualIdentifier => ({ names: id.names.map(s => s.value) })

export const concatVid = (a: VirtualIdentifier, b: VirtualIdentifier): VirtualIdentifier => ({
    names: [...a.names, ...b.names]
})
