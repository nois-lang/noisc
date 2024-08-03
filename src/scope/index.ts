import { Module } from '../ast'
import { Name } from '../ast/operand'
import { FnDef, ImplDef, TraitDef } from '../ast/statement'
import { Generic } from '../ast/type'
import { TypeDef, Variant } from '../ast/type-def'
import { Config } from '../config'
import { Package } from '../package'
import { SemanticError } from '../semantic/error'
import { unreachable } from '../util/todo'

export type Context = {
    config: Config
    // TODO: store reference chain instead of plain modules to track recursion
    moduleStack: Module[]
    packages: Package[]
    /**
     * `std::prelude` module
     */
    prelude?: Module
    errors: SemanticError[]
    warnings: SemanticError[]
    /**
     * Suppress all errors and warnings that coming while the field is false
     */
    silent: boolean
    variableCounter: number
}

/**
 * Key is a name of the def
 */
export type DefinitionMap = Map<string, Definition>

export type Definition = Module | Name | FnDef | TraitDef | ImplDef | TypeDef | Variant | Generic

export const defKey = (def: Definition): string => {
    switch (def.kind) {
        case 'module':
            return vidToString(def.identifier)
        case 'name':
            return def.value
        case 'fn-def':
        case 'trait-def':
        case 'type-def':
        case 'variant':
        case 'generic':
            return def.name.value
        case 'impl-def':
            if (!def.forTrait) {
                return def.identifier.names[0].value
            }
            return unreachable()
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

export const eachModule = (f: (module: Module, ctx: Context) => void, ctx: Context): void => {
    ctx.packages.forEach(p =>
        p.modules.forEach(m => {
            ctx.moduleStack.push(m)
            f(m, ctx)
            ctx.moduleStack.pop()
        })
    )
}
