import { Module } from '../ast'
import { ClosureExpr, Operand } from '../ast/operand'
import { FnDef, ImplDef, TraitDef } from '../ast/statement'
import { TypeDef } from '../ast/type-def'
import { Config } from '../config'
import { Package } from '../package'
import { SemanticError } from '../semantic/error'
import { InstanceRelation } from './trait'
import { vidToString } from './util'
import { Definition, VirtualIdentifier } from './vid'

export interface Context {
    config: Config
    // TODO: store reference chain instead of plain modules
    moduleStack: Module[]
    packages: Package[]
    /**
     * `std::prelude` module
     */
    prelude: Module
    impls: InstanceRelation[]
    errors: SemanticError[]
    warnings: SemanticError[]
    /**
     * When disabled, semantic checker will visit fn-def blocks only to populate top-level type information
     */
    check: boolean
    /**
     * Suppress all errors and warnings that coming while the field is false
     */
    silent: boolean
    variableCounter: number

    relChainsMemo: Map<string, InstanceRelation[][]>
}

export type Scope = InstanceScope | TypeDefScope | FnDefScope | BlockScope | ModuleScope

/**
 * Map id has to be composite, since different defs might have the same vid, e.g.
 * type Option and impl Option.
 * Due to JS limitations, definition must be converted into string first
 * Use {@link defKey} to create keys
 */
export type DefinitionMap = Map<string, Definition>

export interface InstanceScope extends BaseScope {
    kind: 'instance'
    def: TraitDef | ImplDef
    rel?: InstanceRelation
}

export interface TypeDefScope extends BaseScope {
    kind: 'type'
    def: TypeDef
    vid: VirtualIdentifier
}

export interface FnDefScope extends BaseScope {
    kind: 'fn'
    def: FnDef | ClosureExpr
    returns: Operand[]
}

export interface BlockScope extends BaseScope {
    kind: 'block'
    isLoop: boolean
    allBranchesReturned: boolean
}

export interface ModuleScope extends BaseScope {
    kind: 'module'
}

export interface BaseScope {
    definitions: DefinitionMap
    closures: ClosureExpr[]
}

export const defKey = (def: Definition): string => {
    switch (def.kind) {
        case 'module':
            return def.kind + vidToString(def.identifier)
        case 'self':
            return def.kind
        case 'name-def':
        case 'fn-def':
        case 'trait-def':
        case 'type-def':
        case 'generic':
            return def.kind + def.name.value
        case 'method-def':
            return 'fn-def' + def.fn.name.value
        case 'impl-def':
            return def.kind + def.identifier.names.at(-1)!.value
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

export const unwindScope = (ctx: Context): Scope[] => {
    const module = ctx.moduleStack.at(-1)!
    return module.scopeStack.toReversed()
}

export const instanceScope = (ctx: Context): InstanceScope | undefined => {
    return <InstanceScope | undefined>unwindScope(ctx).find(s => s.kind === 'instance')
}

export const instanceRelation = (instanceDef: ImplDef | TraitDef, ctx: Context): InstanceRelation | undefined => {
    return ctx.impls.find(i => i.instanceDef === instanceDef)
}

export const fnDefScope = (ctx: Context): FnDefScope | undefined => {
    return <FnDefScope | undefined>unwindScope(ctx).find(s => s.kind === 'fn')
}

export const addError = (ctx: Context, error: SemanticError): void => {
    if (!ctx.silent) {
        // console.trace(
        //     prettySourceMessage(error.message, getSpan(error.node.parseNode), error.module.source, error.notes)
        // )
        ctx.errors.push(error)
    }
}

export const addWarning = (ctx: Context, error: SemanticError): void => {
    if (!ctx.silent) {
        ctx.warnings.push(error)
    }
}

export const enterScope = (module: Module, scope: Scope, ctx: Context): void => {
    module.scopeStack.push(scope)
}

export const leaveScope = (module: Module, ctx: Context): void => {
    // TODO: check malleable closures getting out of scope
    module.scopeStack.pop()
}
