import { AstNode, Module } from '../ast'
import { Identifier, Name } from '../ast/operand'
import { TraitDef, TraitStatement } from '../ast/statement'
import { TypeParam } from '../ast/type'
import { FieldDef, TypeDef, Variant } from '../ast/type-def'
import { Config } from '../config'
import { prettySourceMessage } from '../error'
import { Package } from '../package'
import { ParseNode, getSpan } from '../parser'
import { StdTypeIds } from '../phase/std-type'
import { SemanticError, duplicateDefError } from '../semantic/error'
import { typeToString } from '../typecheck'

export type Context = {
    config: Config
    // TODO: store reference chain instead of plain modules to track recursion
    moduleStack: Module[]
    packages: Package[]
    stdTypeIds: StdTypeIds
    /**
     * `std::prelude` module
     */
    prelude?: Module
    errors: SemanticError[]
    warnings: SemanticError[]
    unifyStack: string[]
    /**
     * Suppress all errors and warnings that coming while the field is false
     */
    variableCounter: number
}

export type TypeDefinition = TraitDef | TypeDef | TypeParam

export type ValueDefinition = Name | Variant | FieldDef | TraitStatement

export type Definition = ValueDefinition | TypeDefinition | Module

export type Namespace = 'type' | 'value'

export type Scope = {
    type: Map<string, TypeDefinition>
    value: Map<string, ValueDefinition>
    module: Map<string, Module>
}

export const makeScope = (): Scope => ({ type: new Map(), value: new Map(), module: new Map() })

export const defKey = (def: Definition): string => {
    switch (def.kind) {
        case 'name':
            return def.value
        case 'module':
            return idToString(def.identifier)
        default:
            return defKey(def.name)
    }
}

export const addDef = (node: Definition, scope: Scope, ctx: Context, sourceNode: AstNode = node): void => {
    const key = defKey(node)
    switch (node.kind) {
        case 'type-def':
        case 'trait-def':
        case 'type-param':
            if (scope.type.has(key)) {
                addError(ctx, duplicateDefError(ctx, sourceNode))
                break
            }
            scope.type.set(key, node)
            break
        case 'name':
        case 'variant':
        case 'field-def':
        case 'trait-statement':
            if (scope.value.has(key)) {
                addError(ctx, duplicateDefError(ctx, sourceNode))
                break
            }
            scope.value.set(key, node)
            break
        case 'module':
            scope.module.set(key, node)
            break
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

export const addError = (ctx: Context, error: SemanticError, immediate = false): void => {
    if (immediate) {
        console.trace(
            prettySourceMessage(
                error.message,
                error.source,
                error.node.parseNode ? getSpan(error.node.parseNode) : undefined,
                error.notes
            )
        )
    }
    ctx.errors.push(error)
}

export const addWarning = (ctx: Context, error: SemanticError): void => {
    ctx.warnings.push(error)
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
