import { Module } from '../ast'
import { ImplDef, TraitDef } from '../ast/statement'
import { TypeDef } from '../ast/type-def'
import { Config } from '../config'
import { Package } from '../package'
import { SemanticError } from '../semantic/error'
import { VirtualType } from '../typecheck'
import { todo } from '../util/todo'
import { ImplRelation } from './trait'
import { vidToString } from './util'
import { Definition, VirtualIdentifier } from './vid'

export interface Context {
    config: Config
    // TODO: store reference chain instead of plain modules
    moduleStack: Module[]
    packages: Package[]
    impls: ImplRelation[]
    errors: SemanticError[]
    warnings: SemanticError[]
    /**
     * Whether should perform semantic checking or not
     */
    check: boolean
}

export type Scope = TraitScope | ImplScope | TypeDefScope | CommonScope

/**
 * Due to JS limitations, map id has to be composite, since different defs might have the same vid, e.g.
 * type Option and impl Option.
 * Use {@link defKey} to create keys
 */
export type DefinitionMap = Map<string, Definition>

// TODO: refactor TraitScope and ImplScope into a single InstanceScope
export interface TraitScope {
    kind: 'trait-def',
    definitions: DefinitionMap
    selfType: VirtualType,
    def: TraitDef,
}

export interface ImplScope {
    kind: 'impl-def',
    definitions: DefinitionMap
    selfType: VirtualType,
    def: ImplDef,
}

export interface TypeDefScope {
    kind: 'type-def',
    definitions: DefinitionMap
    def: TypeDef,
    vid: VirtualIdentifier
}

export interface CommonScope {
    kind: 'module' | 'fn-def' | 'block',
    definitions: DefinitionMap
}

export const defKey = (def: Definition): string => {
    switch (def.kind) {
        case 'module':
            return def.kind + vidToString(def.identifier)
        case 'self':
            return def.kind
        case 'var-def':
            if (def.pattern.kind !== 'name') return todo('var-def key')
            return def.kind + def.pattern.value
        case 'param':
            if (def.param.pattern.kind !== 'name') return todo('var-def key')
            return def.kind + def.param.pattern.value
        case 'fn-def':
        case 'trait-def':
        case 'type-def':
        case 'generic':
            return def.kind + def.name.value
        case 'method-def':
            return 'fn-def' + def.fn.name.value
        case 'impl-def':
            return def.kind + def.identifier.name.value
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
    return { names: dirs }
}

export const instanceScope = (ctx: Context): ImplScope | TraitScope | undefined => {
    const module = ctx.moduleStack.at(-1)!
    for (let i = module.scopeStack.length - 1; i >= 0; i--) {
        let scope = module.scopeStack[i]
        if (scope.kind === 'impl-def' || scope.kind === 'trait-def') {
            return scope
        }
    }
    return undefined
}
