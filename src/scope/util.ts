import { Identifier } from "../ast/operand"
import { VirtualIdentifier } from "./vid"

export const vidFromString = (str: string): VirtualIdentifier => {
    const tokens = str.split('::')
    return { scope: tokens.slice(0, -1), name: tokens.at(-1)! }
}

export const vidToString = (vid: VirtualIdentifier): string => [...vid.scope, vid.name].join('::')

export const vidScopeToString = (vid: VirtualIdentifier) => vid.scope.join('::')

export const vidFromScope = (vid: VirtualIdentifier): VirtualIdentifier => ({
    scope: vid.scope.slice(0, -1),
    name: vid.scope.at(-1)!
})

export const vidFirst = (vid: VirtualIdentifier): string => vid.scope.at(0) || vid.name

export const idToVid = (id: Identifier): VirtualIdentifier => ({
    scope: id.scope.map(s => s.value),
    name: id.name.value
})

export const concatVid = (a: VirtualIdentifier, b: VirtualIdentifier): VirtualIdentifier => {
    return { scope: [...a.scope, a.name, ...b.scope], name: b.name }
}

