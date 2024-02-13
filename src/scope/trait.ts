import { Module } from '../ast'
import { ImplDef, TraitDef } from '../ast/statement'
import { TypeDef } from '../ast/type-def'
import { notFoundError } from '../semantic/error'
import { VirtualType, genericToVirtual, typeToVirtual } from '../typecheck'
import { makeGenericMapOverStructure, resolveType } from '../typecheck/generic'
import { assert } from '../util/todo'
import { Context, addError, defKey } from './index'
import { concatVid, idToVid, vidEq, vidFromString, vidToString } from './util'
import { VirtualIdentifier, VirtualIdentifierMatch, resolveVid } from './vid'

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
    const traitType: VirtualType = {
        kind: 'vid-type',
        identifier: { names: [...module.identifier.names, instance.name.value] },
        // self args are for bounds and should be excluded from virtual types
        typeArgs: instance.generics.filter(g => g.name.value !== 'Self').map(g => genericToVirtual(g, ctx))
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
        const ref = resolveVid(idToVid(instance.forTrait), ctx, ['type-def', 'trait-def'])
        if (!ref || (ref.def.kind !== 'type-def' && ref.def.kind !== 'trait-def')) {
            addError(ctx, notFoundError(ctx, instance.identifier, vidToString(implVid), 'trait'))
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
export const traitDefToVirtualType = (traitDef: TraitDef | ImplDef, ctx: Context): VirtualType => {
    const module = ctx.moduleStack.at(-1)!
    const name = traitDef.kind === 'trait-def' ? traitDef.name.value : traitDef.identifier.names.at(-1)!.value
    return {
        kind: 'vid-type',
        identifier: concatVid(module.identifier, vidFromString(name)),
        typeArgs: traitDef.generics.map(g => genericToVirtual(g, ctx))
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
