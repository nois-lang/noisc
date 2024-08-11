import { Module } from '../ast'
import { Identifier, Name } from '../ast/operand'
import { FnDef, ImplDef, TraitDef } from '../ast/statement'
import { Generic, Type } from '../ast/type'
import { TypeDef, Variant } from '../ast/type-def'
import { Config } from '../config'
import { Package } from '../package'
import { ParseNode } from '../parser'
import { SemanticError } from '../semantic/error'
import { InferredType } from '../typecheck'
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
            return idToString(def.identifier)
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

export const idToString = (id: Identifier): string => {
    const main = id.names.map(n => n.value).join('::')
    const typeArgs = id.typeArgs.length > 0 ? `<${id.typeArgs.map(typeToString).join(', ')}>` : ''
    return main + typeArgs
}

export const idEq = (a: Identifier, b: Identifier): boolean => {
    if (a.names.length !== b.names.length) return false
    for (let i = 0; i < a.names.length; i++) {
        if (a.names[i].value !== b.names[i].value) return false
    }
    return true
}

export const idFromString = (str: string, parseNode?: ParseNode): Identifier => {
    return {
        kind: 'identifier',
        parseNode,
        typeArgs: [],
        names: str.split('::').map(n => ({ kind: 'name', value: n }))
    }
}

export const inferredTypeToString = (t: InferredType): string => {
    switch (t.kind) {
        case 'inferred': {
            if (t.unified) {
                return typeToString(t.unified)
            }
            return t.bounds.length > 0 ? `[${t.bounds.map(typeToString).join(', ')}]` : '_'
        }
        case 'return': {
            return `ret(${typeToString(t.type)})`
        }
    }
}

export const typeToString = (t: Type): string => {
    switch (t.kind) {
        case 'identifier':
            return idToString(t)
        case 'fn-type':
            const main = `|${t.paramTypes.map(typeToString).join(', ')}|: ${typeToString(t.returnType)}`
            const typeArgs = t.generics.length > 0 ? `<${t.generics.map(g => g.name.value).join(', ')}>` : ''
            return typeArgs + main
        case 'hole':
            return '_'
        case 'inferred':
        case 'return':
            return inferredTypeToString(t)
    }
}

export const pathToId = (path: string, packageName?: string): Identifier => {
    const dirs = path.replace(/\.no$/, '').split('/')
    if (packageName) {
        dirs.unshift(packageName)
    }
    if (dirs.at(-1)!.toLowerCase() === 'mod') {
        dirs.pop()
    }
    return idFromString(dirs.join('::'))
}

export const addError = (ctx: Context, error: SemanticError): void => {
    if (!ctx.silent) {
        // console.trace(
        //     prettySourceMessage(
        //         error.message,
        //         error.source,
        //         error.node.parseNode ? getSpan(error.node.parseNode) : undefined,
        //         error.notes
        //     )
        // )
        ctx.errors.push(error)
    }
}

export const addWarning = (ctx: Context, error: SemanticError): void => {
    if (!ctx.silent) {
        ctx.warnings.push(error)
    }
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
