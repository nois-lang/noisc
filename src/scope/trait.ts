import { Module } from '../ast'
import { ImplDef, TraitDef } from '../ast/statement'
import { VirtualType, genericToVirtual, typeToVirtual } from '../typecheck'
import { Context } from './index'
import { concatVid, idToVid, vidFromString, vidToString, } from './util'
import { VirtualIdentifier, VirtualIdentifierMatch, resolveVid } from './vid'

/**
 * Find all implemented traits and self impls for specified type
 */
export const findTypeTraits = (typeVid: VirtualIdentifier, ctx: Context): VirtualIdentifierMatch<TraitDef | ImplDef>[] => {
    return ctx.impls.flatMap(impl => {
        const targetVid = getImplTargetVid(impl, ctx)
        if (!targetVid) return []
        const targetRef = resolveVid(targetVid, ctx, ['type-def', 'trait-def'])
        // not all impl refs will resolve with current module imports
        if (!targetRef) return []
        if (vidToString(targetRef.vid) === vidToString(typeVid)) {
            const ref = resolveVid(idToVid(impl.identifier), ctx, ['trait-def', 'impl-def'])
            if (!ref) return []
            if (ref.def.kind === 'trait-def' || ref.def.kind === 'impl-def') {
                return [
                    { vid: ref.vid, def: ref.def },
                    // TODO: recursively check impls, some infinite recursion issue
                    // ...findTypeTraits(getImplTargetVid(ref.def, ctx)!, ctx)
                ]
            }
            return []
        }
        return []
    })
}

export const findImpls = (module: Module): ImplDef[] =>
    module.block.statements.flatMap(s => s.kind !== 'impl-def' ? [] : s)

/**
 * Get type impl is attached to:
 * trait A      -> A
 * impl A       -> A
 * impl A for B -> B
 */
export const getImplTargetVid = (implDef: TraitDef | ImplDef, ctx: Context): VirtualIdentifier | undefined => {
    if (implDef.kind === 'trait-def') {
        return vidFromString(implDef.name.value)
    }
    return idToVid(implDef.forTrait ? implDef.forTrait : implDef.identifier)
}

export const getImplTargetType = (implDef: TraitDef | ImplDef, ctx: Context): VirtualType => {
    if (implDef.kind === 'trait-def') {
        return {
            kind: 'vid-type',
            identifier: resolveVid(vidFromString(implDef.name.value), ctx)!.vid,
            typeArgs: implDef.generics.map(g => genericToVirtual(g, ctx))
        }
    }
    if (implDef.forTrait) {
        return typeToVirtual(implDef.forTrait, ctx)
    } else {
        return {
            kind: 'vid-type',
            identifier: resolveVid(idToVid(implDef.identifier), ctx)!.vid,
            typeArgs: implDef.generics.map(g => genericToVirtual(g, ctx))
        }
    }
}

export const traitDefToVirtualType = (traitDef: TraitDef, ctx: Context): VirtualType => {
    const module = ctx.moduleStack.at(-1)!
    return {
        kind: 'vid-type',
        identifier: concatVid(module.identifier, vidFromString(traitDef.name.value)),
        typeArgs: traitDef.generics.map(g => genericToVirtual(g, ctx))
    }
}
