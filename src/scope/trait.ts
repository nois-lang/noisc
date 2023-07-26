import {
    concatVid,
    idToVid,
    resolveVid,
    vidFromString,
    vidToString,
    VirtualIdentifier,
    VirtualIdentifierMatch
} from './vid'
import { Context } from './index'
import { ImplDef, TraitDef } from '../ast/statement'
import { Module } from '../ast'
import { genericToVirtual, TypeDefType, typeToVirtual, VirtualType } from '../typecheck'

/**
 * Find all implemented traits and self impls for specified type, available in the current scope
 */
export const findTypeTraits = (typeVid: VirtualIdentifier, ctx: Context): VirtualIdentifierMatch<TraitDef | ImplDef>[] => {
    return ctx.impls.flatMap(impl => {
        const targetVid = getImplTargetVid(impl, ctx)
        if (!targetVid) return []
        const ref = resolveVid(targetVid, ctx, ['trait-def', 'impl-def'])
        // not all impl refs will resolve with current module imports
        if (!ref) return []
        if (vidToString(ref.qualifiedVid) === vidToString(typeVid)) {
            const def = resolveVid(idToVid(impl.identifier), ctx, ['trait-def', 'impl-def'])
            if (!def) return []
            if (def.def.kind === 'trait-def' || def.def.kind === 'impl-def') {
                return [{ qualifiedVid: def.qualifiedVid, def: def.def }]
            }
            return []
        }
        return []
    })
}

export const findImpls = (module: Module): ImplDef[] =>
    module.block.statements.flatMap(s => s.kind !== 'impl-def' ? [] : s)

export const getImplTargetVid = (implDef: TraitDef | ImplDef, ctx: Context): VirtualIdentifier | undefined => {
    if (implDef.kind === 'trait-def') {
        return resolveVid(vidFromString(implDef.name.value), ctx)?.qualifiedVid
    }
    if (implDef.forTrait) {
        return resolveVid(idToVid(implDef.forTrait), ctx)?.qualifiedVid
    } else {
        return resolveVid(idToVid(implDef.identifier), ctx)?.qualifiedVid
    }
}

export const getImplTargetType = (implDef: TraitDef | ImplDef, ctx: Context): VirtualType => {
    if (implDef.kind === 'trait-def') {
        return {
            kind: 'type-def',
            identifier: resolveVid(vidFromString(implDef.name.value), ctx)!.qualifiedVid,
            generics: implDef.generics.map(g => genericToVirtual(g, ctx))
        }
    }
    if (implDef.forTrait) {
        return typeToVirtual(implDef.forTrait, ctx)
    } else {
        return {
            kind: 'type-def',
            identifier: resolveVid(idToVid(implDef.identifier), ctx)!.qualifiedVid,
            generics: implDef.generics.map(g => genericToVirtual(g, ctx))
        }
    }
}

export const traitDefToTypeDefType = (traitDef: TraitDef, ctx: Context): TypeDefType => {
    const module = ctx.moduleStack.at(-1)!
    return {
        kind: 'type-def',
        identifier: concatVid(module.identifier, vidFromString(traitDef.name.value)),
        generics: traitDef.generics.map(g => genericToVirtual(g, ctx))
    }
}
