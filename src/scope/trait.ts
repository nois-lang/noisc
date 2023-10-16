import { Module } from '../ast'
import { ImplDef, TraitDef } from '../ast/statement'
import { TypeDef } from '../ast/type-def'
import { notFoundError } from '../semantic/error'
import { VirtualType, genericToVirtual, typeToVirtual } from '../typecheck'
import { resolveGenericsOverStructure, resolveType } from '../typecheck/generic'
import { unknownType } from '../typecheck/type'
import { assert } from '../util/todo'
import { Context } from './index'
import { concatVid, idToVid, vidFromString, vidToString } from './util'
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
}

export const buildInstanceRelations = (ctx: Context): InstanceRelation[] => {
    const impls = ctx.packages
        .flatMap(p => p.modules)
        .flatMap(m =>
            m.block.statements.filter(s => s.kind === 'trait-def' || s.kind === 'impl-def')
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
const getImplRel = (impl: TraitDef | ImplDef, ctx: Context): InstanceRelation | undefined => {
    const module = ctx.moduleStack.at(-1)!
    if (impl.kind === 'trait-def') {
        const traitType: VirtualType = {
            kind: 'vid-type',
            identifier: { names: [...module.identifier.names, impl.name.value] },
            typeArgs: impl.generics.map(g => genericToVirtual(g, ctx))
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
            instanceDef: impl,
        }
    } else {
        const implVid = idToVid(impl.identifier)
        const ref = resolveVid(implVid, ctx, ['trait-def', 'type-def'])
        if (!ref || (ref.def.kind !== 'trait-def' && ref.def.kind !== 'type-def')) {
            ctx.errors.push(notFoundError(ctx, impl.identifier, vidToString(implVid)))
            return undefined
        }
        const implRef = <VirtualIdentifierMatch<TypeDef | TraitDef>>ref

        let forDef: VirtualIdentifierMatch<TypeDef | TraitDef> = implRef
        if (impl.forTrait) {
            const ref = resolveVid(idToVid(impl.forTrait), ctx, ['type-def', 'trait-def'])
            if (!ref || (ref.def.kind !== 'type-def' && ref.def.kind !== 'trait-def')) {
                ctx.errors.push(notFoundError(ctx, impl.identifier, vidToString(implVid), 'trait'))
                return undefined
            }
            forDef = <VirtualIdentifierMatch<TypeDef | TraitDef>>ref
        }

        const implType = typeToVirtual(impl.identifier, ctx)
        return {
            module,
            implType: implType,
            forType: impl.forTrait ? typeToVirtual(impl.forTrait, ctx) : implType,
            implDef: <VirtualIdentifierMatch<TypeDef | TraitDef>>ref,
            forDef: forDef,
            instanceDef: impl,
        }
    }
}

/**
 * Find all instance relation chains to supertypes (types/traits implemented by specified type), ignoring current scope
 * Chains take a format [type, ..., super]
 * Every chain corresponds to a single supertype
 * For all, chain.length >= 2
 */
export const findSuperRelChains = (
    typeVid: VirtualIdentifier,
    ctx: Context,
    chain: InstanceRelation[] = []
): InstanceRelation[][] => {
    const ref = resolveVid(typeVid, ctx)
    if (!ref) return []

    const vid = vidToString(typeVid)
    const chains = ctx.impls
        .filter(r =>
            r.forType.kind === 'vid-type' &&
            vidToString(r.forType.identifier) === vid &&
            // avoid infinite recursion by looking up for the same type
            vidToString(r.implDef.vid) !== vid
        )
        .flatMap(r => {
            const newChain = [...chain, r]
            return [newChain, ...findSuperRelChains(r.implDef.vid, ctx, newChain)]
        })

    return chains
}

/**
 * Find all impls by specified type vid
 */
export const findTypeImpls = (typeVid: VirtualIdentifier, ctx: Context): InstanceRelation[] => {
    const vid = vidToString(typeVid)
    return ctx.impls.filter(i => vidToString(i.implDef.vid) === vid)
}

/**
 * Find all instance defs in module
 */
export const findInstanceDefs = (module: Module): (TraitDef | ImplDef)[] =>
    module.block.statements.flatMap(s => (s.kind === 'trait-def' || s.kind === 'impl-def') ? s : [])

export const getInstanceForType = (implDef: TraitDef | ImplDef, ctx: Context): VirtualType => {
    const implRel = ctx.impls.find(i => i.instanceDef === implDef)
    return implRel?.forType ?? unknownType
}

/**
 * Convert instance def into virtual type.
 * Must be defined in a module that is currently at the top of module stack
 */
export const traitDefToVirtualType = (traitDef: TraitDef | ImplDef, ctx: Context): VirtualType => {
    const module = ctx.moduleStack.at(-1)!
    const name = traitDef.kind === 'trait-def' ? traitDef.name.value : traitDef.identifier.name.value
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
    const genericMap = resolveGenericsOverStructure(type, rel.forType)
    return resolveType(rel.implType, [genericMap], rel.implDef.def, ctx)
}
