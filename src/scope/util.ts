import { Identifier } from "../ast/operand"
import { VirtualIdentifier } from "./vid"

export const vidFromString = (str: string): VirtualIdentifier => ({ names: str.split('::') })

export const vidToString = (vid: VirtualIdentifier): string => vid.names.join('::')

export const vidScopeToString = (vid: VirtualIdentifier) => vidToString(vidFromScope(vid))

export const vidFromScope = (vid: VirtualIdentifier): VirtualIdentifier => ({ names: vid.names.slice(0, -1) })

export const idToVid = (id: Identifier): VirtualIdentifier => ({ names: [...id.scope.map(s => s.value), id.name.value] })

export const concatVid = (a: VirtualIdentifier, b: VirtualIdentifier): VirtualIdentifier => ({ names: [...a.names, ...b.names] })

