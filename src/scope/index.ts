import { Module } from '../ast'
import { FnDef, ImplDef, TraitDef } from '../ast/statement'
import { isAssignable, typeToVirtual, VirtualType } from '../typecheck'
import { Definition, VirtualIdentifier } from './vid'
import { Config } from '../config'
import { SemanticError } from '../semantic/error'
import { todo } from '../util/todo'

export interface Context {
    config: Config
    moduleStack: Module[]
    modules: Module[]
    impls: ImplDef[]
    errors: SemanticError[]
    warnings: SemanticError[]
}

export type Scope = TraitScope | ImplScope | CommonScope

/**
 * Due to JS limitations, map id has to be composite, since different defs might have the same vid, e.g.
 * type Option and impl Option.
 * Use {@link defKey} to create keys
 */
export type DefinitionMap = Map<string, Definition>

export interface TraitScope {
    type: 'trait-def',
    selfType: VirtualType,
    def: TraitDef,
    definitions: DefinitionMap
}

export interface ImplScope {
    type: 'impl-def',
    selfType: VirtualType,
    def: ImplDef,
    definitions: DefinitionMap
}

export interface CommonScope {
    type: 'module' | 'fn-def' | 'type-def' | 'block',
    definitions: DefinitionMap
}

export const defKey = (def: Definition): string => {
    switch (def.kind) {
        case 'self':
            return def.kind
        case 'module':
            return def.kind + def.identifier.name
        case 'var-def':
        case 'param':
            if (def.pattern.kind !== 'name') return todo('var-def key')
            return def.kind + def.pattern.value
        case 'fn-def':
        case 'trait-def':
        case 'type-def':
        case 'generic':
            return def.kind + def.name.value
        case 'impl-def':
            return def.kind + def.name.value + (def.forTrait?.name ?? '')
        case 'type-con':
            return def.kind + def.typeCon.name.value
    }
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
