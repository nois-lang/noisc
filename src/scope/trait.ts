import { Module } from '../ast'
import { ImplDef, TraitDef } from '../ast/statement'
import { TypeDef } from '../ast/type-def'
import { notFoundError } from '../semantic/error'
import { VirtualType, genericToVirtual, typeToVirtual } from '../typecheck'
import { assert } from '../util/todo'
import { Context } from './index'
import { concatVid, idToVid, vidFromString, vidToString } from './util'
import { VirtualIdentifier, VirtualIdentifierMatch, resolveVid } from './vid'

export interface ImplRelation {
    /**
     * Module impl defined in
     */
    module: Module
    /**
     * Implemented type
     */
    implType: VirtualType
    /**
     * Implemented target type
     */
    forType: VirtualType
    /**
     * Implemented type def
     */
    typeDef: VirtualIdentifierMatch<TypeDef | TraitDef>
    /**
     * Implemented target type def
     */
    forDef: VirtualIdentifierMatch<TypeDef | TraitDef>
    /**
     * Implementation def
     */
    implDef: TraitDef | ImplDef
}

export const buildImplRelations = (ctx: Context): ImplRelation[] => {
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

const getImplRel = (impl: TraitDef | ImplDef, ctx: Context): ImplRelation | undefined => {
    const module = ctx.moduleStack.at(-1)!
    if (impl.kind === 'trait-def') {
        const implType: VirtualType = {
            kind: 'vid-type',
            identifier: { names: [...module.identifier.names, impl.name.value] },
            typeArgs: impl.generics.map(g => genericToVirtual(g, ctx))
        }
        const ref = resolveVid(implType.identifier, ctx, ['trait-def'])
        assert(!!ref, 'traitDef did not find itself by name')
        const traitRef = <VirtualIdentifierMatch<TraitDef>>ref!
        return {
            module,
            implType,
            forType: implType,
            typeDef: traitRef,
            forDef: traitRef,
            implDef: impl,
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
            implType,
            forType: impl.forTrait ? typeToVirtual(impl.forTrait, ctx) : implType,
            typeDef: <VirtualIdentifierMatch<TypeDef | TraitDef>>ref,
            forDef: forDef,
            implDef: impl,
        }
    }
}

/**
 * Find all supertypes (types/traits implemented by specified type), ignoring current scope
 */
export const findSupertypes = (typeVid: VirtualIdentifier, ctx: Context): VirtualIdentifierMatch<TraitDef | TypeDef>[] => {
    const ref = resolveVid(typeVid, ctx)
    if (!ref) return []

    const supertypes = ctx.impls
        .filter(i => i.forType.kind === 'vid-type' && vidToString(i.forType.identifier) === vidToString(typeVid))
        .map(i => i.typeDef)

    return supertypes
}

export const findTypeImpls = (typeVid: VirtualIdentifier, ctx: Context): ImplRelation[] => {
    const vid = vidToString(typeVid)
    return ctx.impls.filter(i => vidToString(i.typeDef.vid) === vid)
}

export const findImpls = (module: Module): (TraitDef | ImplDef)[] =>
    module.block.statements.flatMap(s => (s.kind === 'trait-def' || s.kind === 'impl-def') ? s : [])

/**
 * Get type impl is attached to:
 * trait A      -> A
 * impl A       -> A
 * impl A for B -> B
 */
export const getImplTargetVid = (implDef: TraitDef | ImplDef): VirtualIdentifier => {
    if (implDef.kind === 'trait-def') {
        return vidFromString(implDef.name.value)
    }
    return idToVid(implDef.forTrait ? implDef.forTrait : implDef.identifier)
}

export const getImplTargetType = (implDef: TraitDef | ImplDef, ctx: Context): VirtualType => {
    const implRel = ctx.impls.find(i => i.implDef === implDef)
    assert(!!implRel, `impl relation not found`)
    return implRel!.forType
}

export const traitDefToVirtualType = (traitDef: TraitDef | ImplDef, ctx: Context): VirtualType => {
    const module = ctx.moduleStack.at(-1)!
    const name = traitDef.kind === 'trait-def' ? traitDef.name.value : traitDef.identifier.name.value
    return {
        kind: 'vid-type',
        identifier: concatVid(module.identifier, vidFromString(name)),
        typeArgs: traitDef.generics.map(g => genericToVirtual(g, ctx))
    }
}
