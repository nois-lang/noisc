import { Module } from '../ast'
import { ImplDef, TraitDef } from '../ast/statement'
import { TypeDef } from '../ast/type-def'
import { VirtualType, genericToVirtual, typeToVirtual } from '../typecheck'
import { Context } from './index'
import { concatVid, idToVid, vidFromString } from './util'
import { VirtualIdentifier, VirtualIdentifierMatch, resolveVid } from './vid'

/**
 * Find all supertypes (types/traits implemented by specified type), ignoring current scope
 */
export const findSupertypes = (typeVid: VirtualIdentifier, ctx: Context): VirtualIdentifierMatch<TraitDef | TypeDef>[] => {
    // TODO
    return []
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
