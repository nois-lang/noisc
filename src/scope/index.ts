import { Module } from '../ast'
import { ImplDef, TraitDef } from '../ast/statement'
import { VirtualType } from '../typecheck'
import { Definition, VirtualIdentifier } from './vid'
import { Config } from '../config'
import { SemanticError } from '../semantic/error'
import { todo } from '../util/todo'
import { TypeDef } from '../ast/type-def'

export interface Context {
    config: Config
    moduleStack: Module[]
    modules: Module[]
    impls: ImplDef[]
    errors: SemanticError[]
    warnings: SemanticError[]
}

export type Scope = TraitScope | ImplScope | TypeDefScope | CommonScope

/**
 * Due to JS limitations, map id has to be composite, since different defs might have the same vid, e.g.
 * type Option and impl Option.
 * Use {@link defKey} to create keys
 */
export type DefinitionMap = Map<string, Definition>

export interface TraitScope {
    type: 'trait-def',
    definitions: DefinitionMap
    selfType: VirtualType,
    def: TraitDef,
}

export interface ImplScope {
    type: 'impl-def',
    definitions: DefinitionMap
    selfType: VirtualType,
    def: ImplDef,
}

export interface TypeDefScope {
    type: 'type-def',
    definitions: DefinitionMap
    def: TypeDef,
    vid: VirtualIdentifier
}

export interface CommonScope {
    type: 'module' | 'fn-def' | 'block',
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
            return def.kind + def.identifier.name.value + (def.forTrait?.name ?? '')
        case 'type-con':
            return def.kind + def.typeCon.name.value
    }
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
 * Checks whether current module scope is within ImplDef or TraitDef scope
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
