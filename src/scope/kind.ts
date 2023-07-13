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
import { ImplDef, KindDef } from '../ast/statement'
import { Module } from '../ast'
import { TypeDefType, typeToVirtual, VirtualType } from '../typecheck'

export const findImplKindsWithFn = (typeVid: VirtualIdentifier, methodName: string, ctx: Context): VirtualIdentifierMatch<KindDef>[] => {
    const kindRefs = findTypeKinds(typeVid, ctx)
    return kindRefs.filter(ref =>
        ref.def.block.statements
            .some(s => s.kind === 'fn-def' && s.name.value === methodName)
    )
}

/**
 * Find all impl kinds for specified type, available in the current scope
 */
export const findTypeKinds = (typeVid: VirtualIdentifier, ctx: Context): VirtualIdentifierMatch<KindDef>[] => {
    return ctx.impls.flatMap(impl => {
        const targetVid = getImplTargetVid(impl)
        const ref = resolveVid(targetVid, ctx)
        // not all impl refs will resolve with current module imports
        if (!ref) return []
        const qualifiedTargetVid = ref.qualifiedVid
        if (vidToString(qualifiedTargetVid) === vidToString(typeVid)) {
            const def = resolveVid(vidFromString(impl.name.value), ctx)
            if (!def || def.def.kind !== 'kind-def') return []
            return [{ qualifiedVid: def.qualifiedVid, def: def.def }]
        }
        return []
    })
}

export const findImpls = (module: Module): ImplDef[] =>
    module.block.statements.flatMap(s => s.kind !== 'impl-def' ? [] : s)

export const getImplTargetVid = (implDef: ImplDef): VirtualIdentifier => {
    if (implDef.forKind) {
        if (implDef.forKind.kind !== 'variant-type') throw Error('non variant type as impl target')
        return idToVid(implDef.forKind.identifier)
    } else {
        return vidFromString(implDef.name.value)
    }
}

export const getImplTargetType = (implDef: ImplDef, ctx: Context): VirtualType => {
    if (implDef.forKind) {
        if (implDef.forKind.kind !== 'variant-type') throw Error('non variant type as impl target')
        return typeToVirtual(implDef.forKind, ctx)
    } else {
        return { kind: 'type-def', identifier: vidFromString(implDef.name.value), generics: [] }
    }
}

export const kindDefToTypeDefType = (kindDef: KindDef, ctx: Context): TypeDefType => {
    const module = ctx.moduleStack.at(-1)!
    return ({
        kind: 'type-def',
        identifier: concatVid(module.identifier, vidFromString(kindDef.name.value)),
        generics: []
    })
}
