import { Module } from '../ast'
import { ImplDef, TraitDef } from '../ast/statement'
import { TypeDef } from '../ast/type-def'
import { notFoundError } from '../semantic/error'
import {
    VidType,
    VirtualGeneric,
    VirtualType,
    genericToVirtual,
    isAssignable,
    typeEq,
    typeToVirtual
} from '../typecheck'
import { makeGenericMapOverStructure, resolveType } from '../typecheck/generic'
import { assert } from '../util/todo'
import { Context, addError, defKey } from './index'
import { concatVid, idToVid, vidEq, vidFromString, vidToString } from './util'
import { MethodDef, VirtualIdentifier, VirtualIdentifierMatch, resolveVid, typeKinds } from './vid'

/**
 * Description of type/trait/impl relations
 */
export interface InstanceRelation {
    /**
     * Module impl defined in
     */
    module: Module
    /**
     * Implemented type
     */
    implType: VirtualType
    /**
     * For type
     */
    forType: VirtualType
    /**
     * Implemented type def
     */
    implDef: VirtualIdentifierMatch<TypeDef | TraitDef>
    /**
     * For type def
     */
    forDef: VirtualIdentifierMatch<TypeDef | TraitDef>
    /**
     * Instance def
     */
    instanceDef: TraitDef | ImplDef
    /**
     * Generics
     */
    generics: VirtualGeneric[]
    /**
     * There are two types of implementations:
     *   - trait impl: implementing trait for some type
     *   - inherent impl: attaching methods to some type
     */
    inherent: boolean
}

export const buildInstanceRelations = (ctx: Context): InstanceRelation[] => {
    const impls = ctx.packages
        .flatMap(p => p.modules)
        .flatMap(m =>
            m.block.statements
                .filter(s => s.kind === 'trait-def' || s.kind === 'impl-def')
                .map(impl => <const>[m, <ImplDef | TraitDef>impl])
        )
    return impls.flatMap(([module, impl]) => {
        ctx.moduleStack.push(module)
        const implRel = getImplRel(impl, ctx)
        ctx.moduleStack.pop()
        return implRel ? [implRel] : []
    })
}

/**
 * Construct instance relation from instance definition
 */
const getImplRel = (instance: TraitDef | ImplDef, ctx: Context): InstanceRelation | undefined => {
    const module = ctx.moduleStack.at(-1)!
    module.scopeStack.push({ kind: 'impl', definitions: new Map(instance.generics.map(g => [defKey(g), g])) })

    const implRel =
        instance.kind === 'trait-def' ? getTraitImplRel(instance, module, ctx) : getImplImplRel(instance, module, ctx)

    module.scopeStack.pop()

    return implRel
}

const getTraitImplRel = (instance: TraitDef, module: Module, ctx: Context): InstanceRelation | undefined => {
    const generics = instance.generics.filter(g => g.name.value !== 'Self').map(g => genericToVirtual(g, ctx))
    const traitType: VirtualType = {
        kind: 'vid-type',
        identifier: { names: [...module.identifier.names, instance.name.value] },
        // self args are for bounds and should be excluded from virtual types
        typeArgs: generics
    }
    const ref = resolveVid(traitType.identifier, ctx, ['trait-def'])
    assert(!!ref, 'traitDef did not find itself by name')
    const traitRef = <VirtualIdentifierMatch<TraitDef>>ref!
    return {
        module,
        implType: traitType,
        forType: traitType,
        implDef: traitRef,
        forDef: traitRef,
        instanceDef: instance,
        generics,
        inherent: false
    }
}

const getImplImplRel = (instance: ImplDef, module: Module, ctx: Context): InstanceRelation | undefined => {
    const implVid = idToVid(instance.identifier)
    const ref = resolveVid(implVid, ctx, ['trait-def', 'type-def'])
    if (!ref || (ref.def.kind !== 'trait-def' && ref.def.kind !== 'type-def')) {
        addError(ctx, notFoundError(ctx, instance.identifier, vidToString(implVid)))
        return undefined
    }
    const implRef = <VirtualIdentifierMatch<TypeDef | TraitDef>>ref

    let forDef: VirtualIdentifierMatch<TypeDef | TraitDef> = implRef
    if (instance.forTrait) {
        const forTraitVid = idToVid(instance.forTrait)
        const ref = resolveVid(forTraitVid, ctx, typeKinds)
        if (!ref) {
            addError(ctx, notFoundError(ctx, instance.forTrait, vidToString(forTraitVid)))
            return undefined
        }
        forDef = <VirtualIdentifierMatch<TypeDef | TraitDef>>ref
    }

    const implType = typeToVirtual(instance.identifier, ctx)
    const forType = instance.forTrait ? typeToVirtual(instance.forTrait, ctx) : implType
    return {
        module,
        implType,
        forType,
        implDef: <VirtualIdentifierMatch<TypeDef | TraitDef>>ref,
        forDef: forDef,
        instanceDef: instance,
        generics: instance.generics.map(g => genericToVirtual(g, ctx)),
        inherent: !instance.forTrait
    }
}

/**
 * Find all instance relation chains to supertypes (types/traits implemented by specified type), ignoring current scope
 * Chains take a format [type, ..., super]
 * Every chain corresponds to a single `impl for` where type is assignable to impl trait
 * For all, chain.length > 0
 * For example:
 *   - String   -> [Display for String], [Eq for String], ...]
 *   - Iter     -> [[Iterable for Iter], [PeekableAdapter for Iter], [MapAdapter for Iter], ...]
 *   - ListIter -> [[Iter for ListIter], [Iter for ListIter, Iterable for Iter], ...]
 * TODO: detect cases where impl.forType is a generic, e.g. `impl <T: B> A for T`
 */
export const findSuperRelChains = (
    typeVid: VirtualIdentifier,
    ctx: Context,
    chain: InstanceRelation[] = []
): InstanceRelation[][] => {
    const chains = ctx.impls
        // avoid infinite recursion by looking up for the same type
        .filter(r => !vidEq(r.implDef.vid, typeVid) && vidEq(r.forDef.vid, typeVid))
        .flatMap(r => {
            const newChain = [...chain, r]
            return [newChain, ...findSuperRelChains(r.implDef.vid, ctx, newChain)]
        })

    return chains
}

export const getInstanceForType = (implDef: TraitDef | ImplDef, ctx: Context): VirtualType => {
    const implRel = ctx.impls.find(i => i.instanceDef === implDef)
    assert(!!implRel)
    return implRel!.forType
}

/**
 * Convert instance def into virtual type.
 * Must be defined in a module that is currently at the top of module stack
 */
export const traitDefToVirtualType = (traitDef: TraitDef | ImplDef, ctx: Context): VidType => {
    const module = ctx.moduleStack.at(-1)!
    const name = traitDef.kind === 'trait-def' ? traitDef.name.value : traitDef.identifier.names.at(-1)!.value
    return {
        kind: 'vid-type',
        identifier: concatVid(module.identifier, vidFromString(name)),
        typeArgs: traitDef.generics.map(g => genericToVirtual(g, ctx))
    }
}

/**
 * Convert type def into virtual type.
 */
export const typeDefToVirtualType = (typeDef: TypeDef, ctx: Context, module = ctx.moduleStack.at(-1)!): VidType => {
    const name = typeDef.name.value
    return {
        kind: 'vid-type',
        identifier: concatVid(module.identifier, vidFromString(name)),
        typeArgs: typeDef.generics.map(g => genericToVirtual(g, ctx))
    }
}

/**
 * Find concrete type of implType by mapping generics
 * Example: `getConcreteTrait(List<Int>, impl <T> Iterable<T> for List<T>) -> Iterable<Int>`
 */
export const getConcreteTrait = (type: VirtualType, rel: InstanceRelation, ctx: Context): VirtualType => {
    const genericMap = makeGenericMapOverStructure(type, rel.forType)
    return resolveType(rel.implType, [genericMap], ctx)
}

export const relTypeName = (rel: InstanceRelation): string => {
    if (rel.instanceDef.kind === 'impl-def') {
        return rel.instanceDef.identifier.names.at(-1)!.value
    } else {
        return rel.instanceDef.name.value
    }
}

export const resolveGenericImpls = (generic: VirtualGeneric, ctx: Context): InstanceRelation[] => {
    return generic.bounds.flatMap(b => {
        const candidates = ctx.impls
            .filter(i => isAssignable(b, i.implType, ctx))
            .toSorted((a, b) => relComparator(b) - relComparator(a))
        return candidates.length > 0 ? [candidates.at(0)!] : []
    })
}

export const resolveTypeImpl = (
    type: VirtualType,
    traitType: VirtualType,
    ctx: Context
): { trait: InstanceRelation; impl: InstanceRelation } | undefined => {
    if (traitType.kind !== 'vid-type') return undefined
    const traitRef = resolveVid(traitType.identifier, ctx, typeKinds)
    if (!traitRef || traitRef.def.kind !== 'trait-def') return undefined
    const trait = ctx.impls.find(i => i.instanceDef === traitRef.def)!
    const candidates = ctx.impls
        .filter(i => {
            return (
                (i.instanceDef.kind === 'impl-def' ||
                    i.instanceDef.block.statements.every(s => s.kind === 'fn-def' && s.block)) &&
                isAssignable(type, i.forType, ctx) &&
                typeEq(i.implType, traitType)
            )
        })
        .toSorted((a, b) => relComparator(b, ctx, type, traitType) - relComparator(a, ctx, type, traitType))
    const impl = candidates.at(0)
    return impl ? { trait, impl } : undefined
}

export const resolveMethodImpl = (type: VirtualType, method: MethodDef, ctx: Context): InstanceRelation | undefined => {
    const candidates = ctx.impls
        .filter(
            i =>
                (i.instanceDef.kind === 'impl-def' ||
                    i.instanceDef.block.statements.find(
                        s => s.kind === 'fn-def' && s.name.value === method.fn.name.value && s.block
                    )) &&
                isAssignable(type, i.forType, ctx) &&
                typeEq(i.implType, method.rel.implType) &&
                (!i.inherent ||
                    i.instanceDef.block.statements.find(
                        s => s.kind === 'fn-def' && s.name.value === method.fn.name.value
                    ))
        )
        .toSorted(
            (a, b) => relComparator(b, ctx, type, method.rel.forType) - relComparator(a, ctx, type, method.rel.forType)
        )
    return candidates.at(0)
}

export const relComparator = (
    rel: InstanceRelation,
    ctx?: Context,
    implType?: VirtualType,
    forType?: VirtualType
): number => {
    let score = 0
    if (rel.instanceDef.kind === 'impl-def') score += 8
    return score
}
