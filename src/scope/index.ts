import { Module } from '../ast'
import { ImplDef, Statement } from '../ast/statement'
import { SemanticError } from '../semantic'

export interface Context {
    modules: Module[]
    scopeStack: Scope[]
    errors: SemanticError[]
}

export interface Scope {
    statements: Statement[]
}

export interface VirtualIdentifier {
    scope: string[]
    name: string
}

export const vidToString = (vid: VirtualIdentifier) => [...vid.scope, vid.name].join('::')

export const vidScopeToString = (vid: VirtualIdentifier) => vid.scope.join('::')

export const findImplsById = (vId: VirtualIdentifier, ctx: Context): ImplDef[] => {
    return ctx.modules
        .filter(m => vidToString(m.identifier) === vidScopeToString(vId))
        .flatMap(m => m.statements.filter(s => s.kind === 'impl-def').map(s => <ImplDef>s))
        .filter(i => i.identifier.name.value === vId.name)
}
