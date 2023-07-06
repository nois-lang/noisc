import { Identifier } from '../ast/operand'
import { Module } from '../ast'
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

export const vidFirst = (vid: VirtualIdentifier): string => vid.scope.at(0) || vid.name

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

export const resolveVid = (vid: VirtualIdentifier, ctx: Context): Module | Statement | undefined => {
    for (let i = ctx.scopeStack.length - 1; i >= 0; i--) {
        let scope = ctx.scopeStack[i]
        const found = scope.statements.get(vidToString(vid))
        if (found) {
            return found
        }
    }
    for (let useExpr of ctx.useExprs!) {
        if ('value' in useExpr.expr) {
            if (useExpr.expr.value === vidFirst(vid)) {
                const merged: VirtualIdentifier = {
                    scope: [...useExpr.scope.map(n => n.value), ...vid.scope],
                    name: vid.name
                }
                return resolveVidMatched(merged, ctx)
            }
        } else {
            return todo('wildcard useExpr')
        }
    }
    return undefined
}

export const resolveVidMatched = (vid: VirtualIdentifier, ctx: Context): Module | Statement | undefined => {
    let foundModule = ctx.modules.find(m => vidToString(m.identifier) === vidToString(vid))
    if (foundModule) {
        return foundModule
    }
    foundModule = ctx.modules.find(m => vidToString(m.identifier) === vidScopeToString(vid))
    if (foundModule) {
        return foundModule.block.statements.find(s => {
            const v = statementVid(s)
            return v && vidToString(v) === vid.name
        })
    }
    return todo('resolve useExpr')
}
