import { Module } from '../ast'
import { FnDef, ImplDef, TraitDef } from '../ast/statement'
import { isAssignable, typeToVirtual, VirtualType } from '../typecheck'
import { Definition, VirtualIdentifier } from './vid'
import { Config } from '../config'
import { SemanticError } from '../semantic/error'

export interface Context {
    config: Config
    moduleStack: Module[]
    modules: Module[]
    impls: ImplDef[]
    errors: SemanticError[]
    warnings: SemanticError[]
}

export type Scope = TraitScope | ImplScope | CommonScope

export interface TraitScope {
    type: 'trait-def',
    selfType: VirtualType,
    def: TraitDef,
    definitions: Map<string, Definition>
}

export interface ImplScope {
    type: 'impl-def',
    selfType: VirtualType,
    def: ImplDef,
    definitions: Map<string, Definition>
}

export interface CommonScope {
    type: 'module' | 'fn-def' | 'type-def' | 'block',
    definitions: Map<string, Definition>
}

export const findImpl = (vId: VirtualIdentifier, type: VirtualType, ctx: Context): ImplDef | undefined => {
    // TODO: go through imports only
    return ctx.modules
        .flatMap(m => m.block.statements.filter(s => s.kind === 'impl-def').map(s => <ImplDef>s))
        .filter(i => !i.forTrait || isAssignable(type, typeToVirtual(i.forTrait, ctx), ctx))
        .find(i => i.name.value === vId.name)
}

export const findImplFn = (implDef: ImplDef, vid: VirtualIdentifier, ctx: Context): FnDef | undefined => {
    return implDef.block.statements
        .filter(s => s.kind === 'fn-def' && s.name.value === vid.name)
        .map(s => <FnDef>s).at(0)
}

export const pathToVid = (path: string, packageName?: string): VirtualIdentifier => {
    const dirs = path.replace(/\.no$/, '').split('/')
    if (packageName) {
        dirs.unshift(packageName)
    }
    if (dirs.at(-1)!.toLowerCase() === 'mod') {
        dirs.pop()
    }
    const scope = dirs.slice(0, -1)
    const name = dirs.at(-1)!
    return { scope, name }
}

/**
 * Checks whether current module scopeStack is within ImplDef or TraitDef scope
 */
export const instanceScope = (ctx: Context): ImplScope | TraitScope | undefined => {
    const module = ctx.moduleStack.at(-1)!
    for (let i = module.scopeStack.length - 1; i >= 0; i--) {
        let scope = module.scopeStack[i]
        if (scope.type === 'impl-def' || scope.type === 'trait-def') {
            return scope
        }
    }
    return undefined
}
