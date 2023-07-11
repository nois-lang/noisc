import { resolveVid, vidFromString, vidToString, VirtualIdentifier, VirtualIdentifierMatch } from './vid'
import { Context } from './index'
import { KindDef } from '../ast/statement'
import { getImplTargetVid } from './impl'

export const findImplKindsWithFn = (typeVid: VirtualIdentifier, methodName: string, ctx: Context): VirtualIdentifierMatch<KindDef>[] => {
    // TODO
    return []
}

/**
 * Find all impl kinds for specified type, available in the current scope
 */
export const findTypeKinds = (typeVid: VirtualIdentifier, ctx: Context): VirtualIdentifierMatch<KindDef>[] => {
    return ctx.impls.flatMap(impl => {
        if (vidToString(getImplTargetVid(impl)) === vidToString(typeVid)) {
            const def = resolveVid(vidFromString(impl.name.value), ctx)
            if (!def || def.def.kind !== 'kind-def') return []
            return [{ qualifiedVid: def.qualifiedVid, def: def.def }]
        }
        return []
    })
}
