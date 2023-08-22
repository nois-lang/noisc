import { Module, Param } from '../ast'
import { Pattern } from '../ast/match'
import { FnDef, ImplDef, Statement, TraitDef, VarDef } from '../ast/statement'
import { Generic } from '../ast/type'
import { TypeCon, TypeDef } from '../ast/type-def'
import { checkModule } from '../semantic'
import { Typed } from '../typecheck'
import { selfType } from '../typecheck/type'
import { todo } from '../util/todo'
import { Context, instanceScope } from './index'
import { defaultImportedVids } from './std'
import { vidFirst, vidFromString, vidScopeToString, vidToString } from './util'

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
    const module = ctx.moduleStack.at(-1)!

    let ref = resolveStackVid(vid, module, ctx, ofKind)
    if (ref) return ref

    ref = resolveVidMatched(vid, ctx)
    if (ref) return ref

    ref = resolveImportVid(vid, module, ctx)
    if (ref) return ref

    return undefined
}

export const resolveStackVid = (vid: VirtualIdentifier, module: Module, ctx: Context, ofKind: DefinitionKind[]): VirtualIdentifierMatch | undefined => {
    const createRef = <T>(i: number, found: T, matchVid = vid): VirtualIdentifierMatch<T> => {
        // if found in the lowest stack, it is available outside of module, thus should be module-qualified
        if (i === 0) {
            const merged: VirtualIdentifier = {
                scope: [...module.identifier.scope, module.identifier.name, ...matchVid.scope],
                name: matchVid.name
            }
            return { qualifiedVid: merged, def: found }
        }
        return { qualifiedVid: vid, def: found }
    }

    if (vidToString(vid) === selfType.name && instanceScope(ctx)) {
        return { qualifiedVid: vid, def: { kind: 'self' } }
    }

    for (let i = module.scopeStack.length - 1; i >= 0; i--) {
        let scope = module.scopeStack[i]
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

                        const typeDefVid = resolveVid(vidFromString(parentVid), ctx)!.qualifiedVid

                        let typeCon: TypeCon | undefined
                        if (typeDef.variants.length === 0) {
                            // if type is defined without variant, match the default one 
                            typeCon = {
                                kind: 'type-con',
                                parseNode: typeDef.parseNode,
                                name: typeDef.name,
                                fieldDefs: []
                            }
                            typeCon.type = {
                                kind: 'fn-type',
                                paramTypes: [],
                                returnType: { kind: 'vid-type', identifier: typeDefVid, typeArgs: [] },
                                generics: []
                            }
                        } else {
                            typeCon = typeDef.variants.find(v => v.name.value === vid.name)
                        }
                        if (!typeCon) return undefined

                        const ref = createRef<TypeConDef>(i, { kind: 'type-con', typeCon, typeDef })
                        ref.def.type = typeCon.type
                        return ref
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

export const resolveImportVid = (vid: VirtualIdentifier, module: Module, ctx: Context): VirtualIdentifierMatch | undefined => {
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

