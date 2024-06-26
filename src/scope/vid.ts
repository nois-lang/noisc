import { Module } from '../ast'
import { Name } from '../ast/operand'
import { FnDef, ImplDef, Statement, TraitDef } from '../ast/statement'
import { Generic } from '../ast/type'
import { TypeDef, Variant } from '../ast/type-def'
import { TopLevelChecked, checkTopLevelDefinition } from '../semantic'
import { Upcast } from '../semantic/upcast'
import { selfType } from '../typecheck/type'
import { unreachable } from '../util/todo'
import { Context, Scope, instanceScope } from './index'
import { InstanceRelation, findSuperRelChains } from './trait'
import { concatVid, idToVid, vidEq, vidFromString, vidToString } from './util'

export interface VirtualIdentifier {
    names: string[]
}

export const defKinds = <const>[
    'module',
    'name',
    'name-def',
    'self',
    'variant',
    'fn-def',
    'generic',
    'type-def',
    'trait-def',
    'method-def'
]

export type DefinitionKind = (typeof defKinds)[number]

export const typeKinds: DefinitionKind[] = ['type-def', 'trait-def', 'generic', 'self']

export type Definition = (
    | Module
    | NameDef
    | FnDef
    | TraitDef
    | ImplDef
    | TypeDef
    | VariantDef
    | Generic
    | SelfDef
    | MethodDef
) &
    Partial<TopLevelChecked>

export interface NameDef {
    kind: 'name-def'
    name: Name
    parent?: Statement
}

export interface SelfDef {
    kind: 'self'
}

export interface VariantDef {
    kind: 'variant'
    variant: Variant
    typeDef: TypeDef
}

export interface MethodDef {
    kind: 'method-def'
    fn: FnDef
    rel: InstanceRelation
    paramUpcasts?: (Upcast | undefined)[]
}

export interface VirtualIdentifierMatch<D = Definition> {
    vid: VirtualIdentifier
    module: Module
    def: D
}

export const resolveVid = (
    vid: VirtualIdentifier,
    ctx: Context,
    ofKind: DefinitionKind[] = [...defKinds]
): VirtualIdentifierMatch | undefined => {
    const module = ctx.moduleStack.at(-1)!
    const res = resolveVid_(vid, ctx, ofKind)
    if (res && ['variant', 'fn-def', 'type-def', 'name-def'].includes(res.def.kind)) {
        module.imports.push(res)
    }
    return res
}

/**
 * Priority:
 *  - stack variable, e.g. Foo
 *  - import, e.g. Option, option::Option, std::option::Option, Option::Some
 *
 * Vid could be:
 *  - Definition ref, e.g. Foo
 *  - variant or method, e.g. Option::Some or Option::map
 *  - Mix of above with partial or full qualification, e,g. std::option::Option::Some or option::Option::Some
 *  - Module ref, e.g. std::string
 *  - generic ref, e.g. C::fromIter, where C is bounded generic in scope
 *  - `Self`
 */
const resolveVid_ = (
    vid: VirtualIdentifier,
    ctx: Context,
    ofKind: DefinitionKind[] = [...defKinds]
): VirtualIdentifierMatch | undefined => {
    const module = ctx.moduleStack.at(-1)!
    let ref: VirtualIdentifierMatch | undefined

    if (vidToString(vid) === selfType.name && instanceScope(ctx)) {
        return { vid, module, def: { kind: 'self' } }
    }

    // walk through scopes inside out
    for (let i = module.scopeStack.length - 1; i >= 0; i--) {
        ref = resolveScopeVid(vid, module.scopeStack[i], ctx, ofKind, module)
        if (ref) {
            // in case of top-level ref, qualify with module
            if (i === 0) {
                if (ctx.check) {
                    checkTopLevelDefinition(module, ref.def, ctx)
                }
                return {
                    vid: concatVid(module.identifier, ref.vid),
                    module,
                    def: ref.def
                }
            }
            return ref
        }
    }

    // check in top scope
    ref = resolveScopeVid(vid, module.topScope!, ctx, ofKind, module)
    if (ref) {
        if (ctx.check) {
            checkTopLevelDefinition(module, ref.def, ctx)
        }
        return {
            vid: concatVid(module.identifier, ref.vid),
            module,
            def: ref.def
        }
    }

    // check if vid is partially qualified with use exprs
    const matchedUseExprs = [...module.references!, ...ctx.prelude!.reExports!].filter(
        r => r.vid.names.at(-1)! === vid.names[0]
    )
    for (const matchedUseExpr of matchedUseExprs) {
        const qualifiedVid = { names: [...matchedUseExpr.vid.names.slice(0, -1), ...vid.names] }
        const matchedRef = resolveMatchedVid(qualifiedVid, ctx, ofKind)
        if (matchedRef) {
            return matchedRef
        }
    }

    ref = resolveMatchedVid(vid, ctx, ofKind)
    if (ref) return ref

    return undefined
}

export const resolveScopeVid = (
    vid: VirtualIdentifier,
    scope: Scope,
    ctx: Context,
    ofKind: DefinitionKind[],
    module: Module,
    checkSuper: boolean = true
): VirtualIdentifierMatch | undefined => {
    for (const k of ofKind) {
        if (vid.names.length === 1) {
            const name = vid.names[0]
            const def = scope.definitions.get(k + name)
            if (def) {
                return { vid, module, def }
            }
        }
        if (vid.names.length === 2) {
            // resolve variant
            if (k === 'variant') {
                const [typeDefName, variantName] = vid.names
                // match type def by first vid name
                const typeDef = scope.definitions.get('type-def' + typeDefName)
                if (typeDef && typeDef.kind === 'type-def') {
                    checkTopLevelDefinition(module, typeDef, ctx)
                    // if matched, try to find variant with matching name
                    const variant = typeDef.variants.find(v => v.name.value === variantName)
                    if (variant) {
                        return { vid, module, def: { kind: 'variant', typeDef, variant } }
                    }
                }
            }
            // resolve trait/impl fn
            if (k === 'method-def') {
                const [traitName, fnName] = vid.names
                // match trait def by first vid name
                const def =
                    scope.definitions.get('trait-def' + traitName) ?? scope.definitions.get('type-def' + traitName)
                // if matched, try to find fn with matching name in specified trait
                if (def && def.kind === 'trait-def') {
                    checkTopLevelDefinition(module, def, ctx)
                    const fn = def.block.statements.find(s => s.kind === 'fn-def' && s.name.value === fnName)
                    if (fn && fn.kind === 'fn-def') {
                        const rel = ctx.impls.find(i => i.instanceDef === def)!
                        return { vid, module, def: { kind: 'method-def', fn, rel: rel } }
                    }
                }
                // if matched, try to find fn with matching name in type's inherent impl
                if (def && def.kind === 'type-def') {
                    checkTopLevelDefinition(module, def, ctx)
                    const rel = ctx.impls.find(i => i.inherent && i.implDef.def === def)
                    const fn = rel?.instanceDef.block.statements.find(
                        s => s.kind === 'fn-def' && s.name.value === fnName
                    )
                    if (fn && fn.kind === 'fn-def') {
                        return { vid, module, def: { kind: 'method-def', fn, rel: rel! } }
                    }
                }
                if (def && checkSuper) {
                    // lookup supertypes' traits/impls that might contain that function
                    const fullTypeVid = { names: [...(module.identifier.names ?? []), traitName] }
                    const typeRef = resolveVid(fullTypeVid, ctx, ['type-def', 'trait-def'])
                    if (!typeRef || (typeRef.def.kind !== 'type-def' && typeRef.def.kind !== 'trait-def')) {
                        return unreachable()
                    }
                    // TODO: only include traits that are in scope
                    const superRels = findSuperRelChains(typeRef.vid, ctx).map(c => c.at(-1)!)
                    // TODO: sometimes there are duplicates
                    const methodCandidates = superRels.flatMap(superRel => {
                        const fullMethodVid = { names: [...superRel.implDef.vid.names, fnName] }
                        const methodRef = resolveVid(fullMethodVid, ctx, ['method-def'])
                        if (methodRef && methodRef.def.kind === 'method-def') {
                            const module = resolveVid(methodRef.module.identifier, ctx, ['module'])
                            if (!module || module.def.kind !== 'module') return unreachable()
                            checkTopLevelDefinition(module.def, methodRef.def, ctx)
                            return [<VirtualIdentifierMatch<MethodDef>>methodRef]
                        }
                        return []
                    })
                    const methodsInScope = methodCandidates.filter(m => {
                        // unqualified trait name must be in scope
                        const traitName = vidFromString(m.def.rel.implDef.vid.names.at(-1)!)
                        const resolved = resolveVid(traitName, ctx, ['trait-def'])
                        return resolved && resolved.def === m.def.rel.instanceDef
                    })
                    if (methodsInScope.length === 1) {
                        return methodsInScope[0]
                    }
                    if (methodsInScope.length > 1) {
                        // TODO: report
                        return methodsInScope[0]
                    }
                    if (methodCandidates.length > 0) {
                        // TODO: report candidates
                    }
                }
                // resolve generic refd fn
                const [genericName] = vid.names
                const genericDef = scope.definitions.get('generic' + genericName)
                if (genericDef && genericDef.kind === 'generic') {
                    // try to match every bound until first match
                    for (const bound of genericDef.bounds) {
                        const boundVid = idToVid(bound)
                        const fnVid: VirtualIdentifier = { names: [...boundVid.names, fnName] }
                        const boundRef = resolveVid(fnVid, ctx, ['method-def'])
                        if (boundRef) {
                            checkTopLevelDefinition(module, boundRef.def, ctx)
                            return boundRef
                        }
                    }
                }
            }
        }
    }
    return undefined
}

/**
 * Resolve fully qualified vid, e.g. std::iter::Iter or self::foo::Foo
 */
export const resolveMatchedVid = (
    vid: VirtualIdentifier,
    ctx: Context,
    ofKind: DefinitionKind[]
): VirtualIdentifierMatch | undefined => {
    let module: Module | undefined

    let pkg = undefined
    if (vid.names[0] === 'self') {
        vid.names[0] = ctx.moduleStack.at(-1)!.identifier.names[0]
    }
    pkg = ctx.packages.find(p => p.name === vid.names[0])

    if (!pkg) return undefined

    // if vid is module, e.g. std::option
    module = pkg.modules.find(m => vidEq(m.identifier, vid))
    if (module) {
        return { vid, module, def: module }
    }

    // if vid is varDef, typeDef, trait or impl, e.g. std::option::Option
    module = pkg.modules.find(m => vidEq(m.identifier, { names: vid.names.slice(0, -1) }))
    if (module) {
        const moduleLocalVid = { names: vid.names.slice(-1) }
        const ref = resolveScopeVid(moduleLocalVid, module.topScope!, ctx, ofKind, module)
        if (ref) {
            const defModule = resolveVid(ref.module.identifier, ctx, ['module'])
            if (!defModule || defModule.def.kind !== 'module') return unreachable()
            checkTopLevelDefinition(defModule.def, ref.def, ctx)
            return { vid, module, def: ref.def }
        }

        // check re-exports
        for (const reExp of module.reExports!) {
            if (moduleLocalVid.names[0] === reExp.vid.names.at(-1)!) {
                const reExportVid = { names: [...reExp.vid.names.slice(0, -1), ...vid.names.slice(-1)] }
                const ref = resolveMatchedVid(reExportVid, ctx, ofKind)
                if (ref) {
                    return ref
                }
            }
        }
    }

    // if vid is a variant or a traitFn, e.g. std::option::Option::Some
    module = pkg.modules.find(m => vidEq(m.identifier, { names: vid.names.slice(0, -2) }))
    if (module) {
        const moduleLocalVid = { names: vid.names.slice(-2) }
        const ref = resolveScopeVid(moduleLocalVid, module.topScope!, ctx, ofKind, module)
        if (ref) {
            return { vid, module, def: ref.def }
        }

        // check re-exports
        for (const reExp of module.reExports!) {
            if (moduleLocalVid.names[0] === reExp.vid.names.at(-1)!) {
                const reExportVid = { names: [...reExp.vid.names.slice(0, -1), ...vid.names.slice(-2)] }
                const ref = resolveMatchedVid(reExportVid, ctx, ofKind)
                if (ref) {
                    return ref
                }
            }
        }
    }

    return undefined
}
