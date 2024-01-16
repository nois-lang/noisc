import { Module } from '../ast'
import { ClosureExpr } from '../ast/operand'
import { FnDef, ImplDef, ReturnStmt, TraitDef } from '../ast/statement'
import { TypeDef } from '../ast/type-def'
import { Config } from '../config'
import { Package } from '../package'
import { SemanticError } from '../semantic/error'
import { VirtualType } from '../typecheck'
import { InstanceRelation } from './trait'
import { vidToString } from './util'
import { Definition, VirtualIdentifier } from './vid'

export interface Context {
    config: Config
    // TODO: store reference chain instead of plain modules
    moduleStack: Module[]
    packages: Package[]
    impls: InstanceRelation[]
    errors: SemanticError[]
    warnings: SemanticError[]
    /**
     * Whether should perform semantic checking or not
     */
    check: boolean
}

export type Scope = InstanceScope | TypeDefScope | FnDefScope | CommonScope

/**
 * Map id has to be composite, since different defs might have the same vid, e.g.
 * type Option and impl Option.
 * Due to JS limitations, definition must be converted into string first
 * Use {@link defKey} to create keys
 */
export type DefinitionMap = Map<string, Definition>

// TODO: refactor TraitScope and ImplScope into a single InstanceScope
export interface InstanceScope {
    kind: 'instance'
    definitions: DefinitionMap
    selfType: VirtualType
    def: TraitDef | ImplDef
}

export interface TypeDefScope {
    kind: 'type'
    definitions: DefinitionMap
    def: TypeDef
    vid: VirtualIdentifier
}

export interface FnDefScope {
    kind: 'fn'
    definitions: DefinitionMap
    def: FnDef | ClosureExpr
    returnStatements: ReturnStmt[]
}

export interface CommonScope {
    kind: 'module' | 'block'
    definitions: DefinitionMap
}

export const defKey = (def: Definition): string => {
    switch (def.kind) {
        case 'module':
            return def.kind + vidToString(def.identifier)
        case 'self':
            return def.kind
        case 'name-def':
            return def.kind + def.name.value
        case 'fn-def':
        case 'trait-def':
        case 'type-def':
        case 'generic':
            return def.kind + def.name.value
        case 'method-def':
            return 'fn-def' + def.fn.name.value
        case 'impl-def':
            return def.kind + def.identifier.name.value
        case 'variant':
            return def.kind + def.variant.name.value
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

export const instanceScope = (ctx: Context): InstanceScope | undefined => {
    const module = ctx.moduleStack.at(-1)!
    for (let i = module.scopeStack.length - 1; i >= 0; i--) {
        let scope = module.scopeStack[i]
        if (scope.kind === 'instance') {
            return scope
        }
    }
    return undefined
}

export const fnScope = (ctx: Context): FnDefScope | undefined => {
    const module = ctx.moduleStack.at(-1)!
    for (let i = module.scopeStack.length - 1; i >= 0; i--) {
        let scope = module.scopeStack[i]
        if (scope.kind === 'fn') {
            return scope
        }
    }
    return undefined
}
