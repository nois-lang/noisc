import { Identifier } from '../ast/operand'
import { Module, Param } from '../ast'
import { Context, instanceScope } from './index'
import { FnDef, ImplDef, Statement, TraitDef, VarDef } from '../ast/statement'
import { todo } from '../util/todo'
import { Pattern } from '../ast/match'
import { TypeCon, TypeDef } from '../ast/type-def'
import { Generic } from '../ast/type'
import { checkModule } from '../semantic'
import { Typed } from '../typecheck'
import { defaultImportedVids } from './std'
import { selfType } from '../typecheck/type'

export interface VirtualIdentifier {
    scope: string[]
    name: string
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
    qualifiedVid: VirtualIdentifier
    def: D
}

export const vidFromString = (str: string): VirtualIdentifier => {
    const tokens = str.split('::')
    return { scope: tokens.slice(0, -1), name: tokens.at(-1)! }
}

export const vidToString = (vid: VirtualIdentifier): string => [...vid.scope, vid.name].join('::')

export const vidScopeToString = (vid: VirtualIdentifier) => vid.scope.join('::')

export const vidFromScope = (vid: VirtualIdentifier): VirtualIdentifier => ({
    scope: vid.scope.slice(0, -1),
    name: vid.scope.at(-1)!
})

export const vidFirst = (vid: VirtualIdentifier): string => vid.scope.at(0) || vid.name

export const idToVid = (id: Identifier): VirtualIdentifier => ({
    scope: id.scope.map(s => s.value),
    name: id.name.value
})

export const concatVid = (a: VirtualIdentifier, b: VirtualIdentifier): VirtualIdentifier => {
    return { scope: [...a.scope, a.name, ...b.scope], name: b.name }
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

export const resolveVid = (vid: VirtualIdentifier, ctx: Context, ofKind: DefinitionKind[] = [...defKinds]): VirtualIdentifierMatch | undefined => {
    const createRef = (i: number, found: Definition, matchVid = vid) => {
        // if found in the lowest stack, so it is available outside of module, thus should be module-qualified
        if (i === 0) {
            const merged: VirtualIdentifier = {
                scope: [...module.identifier.scope, module.identifier.name, ...matchVid.scope],
                name: matchVid.name
            }
            return { qualifiedVid: merged, def: found }
        }
        return { qualifiedVid: vid, def: found }
    }

    const module = ctx.moduleStack.at(-1)!

    if (vidToString(vid) === selfType.name && instanceScope(ctx)) {
        return { qualifiedVid: vid, def: { kind: 'self' } }
    }

    for (let i = module.scopeStack.length - 1; i >= 0; i--) {
        let scope = module.scopeStack[i]
        // TODO: check local type's constructors
        let found = ofKind
            .map(k => {
                if (vid.scope.length === 1) {
                    const parentVid = vidScopeToString(vid)
                    if (k === 'fn-def') {
                        const trait = ['trait-def', 'impl-def']
                            .map(k => <TraitDef | ImplDef>scope.definitions.get(k + parentVid))
                            .find(d => !!d)
                        if (!trait) return undefined

                        const fn = trait.block.statements
                            .filter(s => s.kind === 'fn-def')
                            .map(s => <FnDef>s)
                            .find(s => s.name.value === vid.name)
                        if (!fn) return undefined

                        return createRef(i, fn)
                    }
                    if (k === 'type-con') {
                        const typeDef = <TypeDef>scope.definitions.get('type-def' + parentVid)
                        if (!typeDef) return undefined

                        const typeCon = typeDef.variants.find(v => v.name.value === vid.name)
                        if (!typeCon) return undefined

                        return createRef(i, { kind: 'type-con', typeCon, typeDef })
                    }
                }
                const def = scope.definitions.get(k + vidToString(vid))
                if (def) {
                    return createRef(i, def)
                }
                return undefined
            })
            .find(def => !!def)

        if (found) {
            return found
        }
    }

    const ref = resolveVidMatched(vid, ctx)
    if (ref) return ref

    for (let useExpr of [...defaultImportedVids(), ...module.references!]) {
        if (vidToString(useExpr) === vidToString(module.identifier)) continue
        if (useExpr.name === vidFirst(vid)) {
            const merged: VirtualIdentifier = {
                scope: [...useExpr.scope, ...vid.scope],
                name: vid.name
            }
            return resolveVidMatched(merged, ctx)
        }
    }
    return undefined
}

export const resolveVidMatched = (vid: VirtualIdentifier, ctx: Context): VirtualIdentifierMatch | undefined => {
    let foundModule = ctx.modules.find(m => vidToString(m.identifier) === vidToString(vid))
    if (foundModule) {
        checkModule(foundModule, ctx, true)
        return { qualifiedVid: vid, def: foundModule }
    }
    foundModule = ctx.modules.find(m => vidToString(m.identifier) === vidScopeToString(vid))
    if (foundModule) {
        checkModule(foundModule, ctx, true)
        const statement = foundModule.block.statements
            .find(s => {
                const v = statementVid(s)
                return v && vidToString(v) === vid.name
            })
        if (!statement) return undefined
        const def = statementToDefinition(statement)
        if (!def) return undefined
        return { qualifiedVid: vid, def }
    }
    return undefined
}
