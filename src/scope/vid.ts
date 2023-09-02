import { match } from 'assert'
import { Module, Param } from '../ast'
import { Pattern } from '../ast/match'
import { FnDef, ImplDef, Statement, TraitDef, VarDef } from '../ast/statement'
import { Generic } from '../ast/type'
import { TypeCon, TypeDef } from '../ast/type-def'
import { checkModule } from '../semantic'
import { Typed } from '../typecheck'
import { selfType } from '../typecheck/type'
import { todo } from '../util/todo'
import { Context, Scope, defKey, instanceScope } from './index'
import { defaultImportedVids } from './std'
import { concatVid, vidFromString, vidScopeToString, vidToString } from './util'

export interface VirtualIdentifier {
    names: string[]
}

export const defKinds = <const>[
    'module',
    'self',
    'type-con',
    'var-def',
    'fn-def',
    'type-def',
    'generic',
    'param',
    'trait-def',
    'impl-def'
]

export type DefinitionKind = typeof defKinds[number]

export type Definition = Module | VarDef | FnDef | TraitDef | ImplDef | TypeDef | TypeConDef | Generic | Param | SelfDef

export type SelfDef = {
    kind: 'self'
}

export interface TypeConDef extends Partial<Typed> {
    kind: 'type-con',
    typeCon: TypeCon,
    typeDef: TypeDef
}

export interface VirtualIdentifierMatch<D = Definition> {
    vid: VirtualIdentifier
    def: D
}

export const statementVid = (statement: Statement): VirtualIdentifier | undefined => {
    switch (statement.kind) {
        case 'var-def':
            return patternVid(statement.pattern)
        case 'fn-def':
        case 'trait-def':
        case 'type-def':
            return vidFromString(statement.name.value)
    }
    return undefined
}

export const statementToDefinition = (statement: Statement): Definition | undefined => {
    switch (statement.kind) {
        case 'var-def':
        case 'fn-def':
        case 'trait-def':
        case 'type-def':
            return statement
    }
    return undefined
}

export const patternVid = (pattern: Pattern): VirtualIdentifier | undefined => {
    switch (pattern.kind) {
        case 'name':
            return vidFromString(pattern.value)
        case 'con-pattern':
            return todo('con-pattern vid')
    }
    return undefined
}

/**
 * Priority:
 *  - stack variable, e.g. Foo
 *  - import, e.g. Option, option::Option, std::option::Option, Option::Some
 *
 * Vid could be:
 *  - Definition ref, e.g. Foo
 *  - TypeCon or TraitFn ref, e.g. Option::Some or Option::map
 *  - Mix of above with partial or full qualification, e,g. std::option::Option::Some or option::Option::Some
 *  - Module ref, e.g. std::string
 *  - `Self`
 */
export const resolveVid = (vid: VirtualIdentifier, ctx: Context, ofKind: DefinitionKind[] = [...defKinds]): VirtualIdentifierMatch | undefined => {
    const module = ctx.moduleStack.at(-1)!
    let ref: VirtualIdentifierMatch | undefined

    if (vidToString(vid) === selfType.name && instanceScope(ctx)) {
        return { vid, def: { kind: 'self' } }
    }

    // walk through scopes inside out
    for (let i = module.scopeStack.length - 1; i >= 0; i--) {
        ref = resolveScopeVid(vid, module.scopeStack[i], ctx, ofKind)
        if (ref) {
            // in case of top-level ref, qualify with module
            if (i === 0) {
                return {
                    vid: concatVid(module.identifier, ref.vid),
                    def: ref.def
                }
            }
            return ref
        }
    }

    // check if fully qualified
    ref = resolveMatchedVid(vid, ctx, ofKind)
    if (ref) return ref

    // check if vid is partially qualified with use exprs
    const matchedUseExpr = [...module.references!, ...defaultImportedVids()].find(r => r.names.at(-1)! === vid.names[0])
    if (matchedUseExpr) {
        const qualifiedVid = { names: [...matchedUseExpr.names.slice(0, -1), ...vid.names] }
        const matchedRef = resolveMatchedVid(qualifiedVid, ctx, ofKind)
        if (matchedRef) {
            return matchedRef
        }
    }

    return undefined
}

const resolveScopeVid = (
    vid: VirtualIdentifier,
    scope: Scope,
    ctx: Context,
    ofKind: DefinitionKind[]
): VirtualIdentifierMatch | undefined => {
    for (let k of ofKind) {
        if (vid.names.length === 1) {
            const name = vid.names[0]
            const def = scope.definitions.get(k + name)
            if (def) {
                return { vid, def }
            }
        }
        if (vid.names.length === 2) {
            // resolve type con
            if (k === 'type-def') {
                const [typeDefName, typeConName] = vid.names
                // match type def by first vid name
                const typeDef = scope.definitions.get(k + typeDefName)
                if (typeDef && typeDef.kind === 'type-def') {
                    // if matched, try to find type con with matching name
                    const typeCon = typeDef.variants.find(v => v.name.value === typeConName)
                    if (typeCon && typeCon.kind === 'type-con') {
                        return { vid, def: { kind: 'type-con', typeDef, typeCon } }
                    }
                }
            }
            // resolve trait/impl fn
            if (k === 'fn-def') {
                const [traitName, fnName] = vid.names
                // match trait/impl def by first vid name
                const traitDef = scope.definitions.get(k + traitName)
                if (traitDef && (traitDef.kind === 'trait-def' || traitDef.kind === 'impl-def')) {
                    // if matched, try to find fn with matching name
                    // TODO: actual fn def could be in a implmented trait
                    const fn = traitDef.block.statements.find(s => s.kind === 'fn-def' && s.name.value === fnName)
                    if (fn && fn.kind === 'fn-def') {
                        return { vid, def: fn }
                    }
                }
            }
        }
    }
    return undefined
}

/**
 * Resolve fully qualified vid
 */
export const resolveMatchedVid = (
    vid: VirtualIdentifier,
    ctx: Context,
    ofKind: DefinitionKind[]
): VirtualIdentifierMatch | undefined => {
    let module: Module | undefined

    const pkg = ctx.packages.find(p => p.name === vid.names[0])
    if (!pkg) return undefined

    // if vid is import, e.g. std::option
    module = pkg.modules.find(m => vidToString(m.identifier) === vidToString(vid))
    if (module) {
        checkModule(module, ctx, true)
        return { vid: vid, def: module }
    }

    // if vid is varDef, typeDef, trait or impl, e.g. std::option::Option
    module = pkg.modules.find(m => vidToString(m.identifier) === vidToString({ names: vid.names.slice(0, -1) }))
    if (module) {
        checkModule(module, ctx, true)
        if (module.topScope) {
            const moduleLocalVid = { names: vid.names.slice(-1) }
            const ref = resolveScopeVid(moduleLocalVid, module.topScope!, ctx, ofKind)
            if (ref) {
                return { vid, def: ref.def }
            }
        } else {
            console.warn('no topScope after check, weird', module.identifier, vid)
        }
    }

    // if vid is typeCon or traitFn, e.g. std::option::Option::Some
    module = pkg.modules.find(m => vidToString(m.identifier) === vidToString({ names: vid.names.slice(0, -2) }))
    if (module) {
        checkModule(module, ctx, true)
        const moduleLocalVid = { names: vid.names.slice(-2) }
        const ref = resolveScopeVid(moduleLocalVid, module.topScope!, ctx, ofKind)
        if (ref) {
            return { vid, def: ref.def }
        }
    }

    return undefined
}

