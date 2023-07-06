import { Identifier } from '../ast/operand'
import { AstNode } from '../ast'
import { Context } from './index'
import { Statement } from '../ast/statement'
import { todo } from '../util/todo'
import { Pattern } from '../ast/match'

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

export const statementVid = (statement: Statement): VirtualIdentifier | undefined => {
    switch (statement.kind) {
        case 'var-def':
            return patternVid(statement.pattern)
        case 'fn-def':
        case 'kind-def':
        case 'type-def':
            return idToVid(statement.identifier)
    }
    return undefined
}

export const patternVid = (pattern: Pattern): VirtualIdentifier | undefined => {
    switch (pattern.kind) {
        case 'name':
            return vidFromString(pattern.value)
        case 'con-pattern':
            return todo('con-pattern vid')
    }
    return undefined
}

export const resolveVid = (vid: VirtualIdentifier, ctx: Context): AstNode<any> | undefined => {
    if (vid.scope.length === 0) {
        for (let i = ctx.scopeStack.length - 1; i > 0; i--) {
            let scope = ctx.scopeStack[i]
            const found = scope.statements.get(vid)
            if (found) {
                return found
            }
        }
    } else {
        return todo('resolve qualified vid')
    }
    return undefined
}
