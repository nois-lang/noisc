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
import { TypeDefType, typeToVirtual, VirtualType } from '../typecheck'

/**
 * Find all impl traits for specified type, available in the current scope
 */
export const findTypeTraits = (typeVid: VirtualIdentifier, ctx: Context): VirtualIdentifierMatch<TraitDef | ImplDef>[] => {
    return ctx.impls.flatMap(impl => {
        const targetVid = getImplTargetVid(impl)
        const ref = resolveVid(targetVid, ctx)
        // not all impl refs will resolve with current module imports
        if (!ref) return []
        const qualifiedTargetVid = ref.qualifiedVid
        if (vidToString(qualifiedTargetVid) === vidToString(typeVid)) {
            const def = resolveVid(vidFromString(impl.name.value), ctx)
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

export const getImplTargetVid = (implDef: ImplDef): VirtualIdentifier => {
    if (implDef.forTrait) {
        return idToVid(implDef.forTrait)
    } else {
        return vidFromString(implDef.name.value)
    }
}

export const getImplTargetType = (implDef: ImplDef, ctx: Context): VirtualType => {
    if (implDef.forTrait) {
        return typeToVirtual(implDef.forTrait, ctx)
    } else {
        return { kind: 'type-def', identifier: vidFromString(implDef.name.value), generics: [] }
    }
}

export const traitDefToTypeDefType = (traitDef: TraitDef, ctx: Context): TypeDefType => {
    const module = ctx.moduleStack.at(-1)!
    return ({
        kind: 'type-def',
        identifier: concatVid(module.identifier, vidFromString(traitDef.name.value)),
        generics: []
    })
}
