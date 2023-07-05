import { Identifier } from '../ast/operand'
import { AstNode } from '../ast'
import { todo } from '../util/todo'
import { Context } from './index'

export interface VirtualIdentifier {
    scope: string[]
    name: string
}

export const scopeResOp: string = '::'

export const vidFromString = (str: string): VirtualIdentifier => {
    const tokens = str.split(scopeResOp)
    return { scope: tokens.slice(0, -1), name: tokens.at(-1)! }
}

export const vidToString = (vid: VirtualIdentifier): string => [...vid.scope, vid.name].join('::')

export const vidScopeToString = (vid: VirtualIdentifier) => vid.scope.join('::')

export const vidFromScope = (vid: VirtualIdentifier): VirtualIdentifier => ({
    scope: vid.scope.slice(0, -1),
    name: vid.scope.at(-1)!
})

export const idToVid = (id: Identifier): VirtualIdentifier => ({
    scope: id.scope.map(s => s.value),
    name: id.name.value
})

export const resolveVid = (vid: VirtualIdentifier, ctx: Context): AstNode<any> | undefined => {
    return todo()
}
