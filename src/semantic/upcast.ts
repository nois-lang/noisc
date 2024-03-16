import { Virtual } from '.'
import { Context } from '../scope'
import { InstanceRelation, relTypeName, resolveTypeImpl } from '../scope/trait'
import { VirtualType } from '../typecheck'
import { makeGenericMapOverStructure } from '../typecheck/generic'

export interface Upcast {
    traits: Map<string, InstanceRelation>
}

export const upcast = (virtual: Partial<Virtual>, type: VirtualType, traitType: VirtualType, ctx: Context): void => {
    const upcastMap = makeUpcastMap(type, traitType, ctx)
    if (upcastMap) {
        virtual.upcasts ??= new Map()
        upcastMap.forEach((up, k) => {
            const existing = virtual.upcasts!.get(k)
            if (existing) {
                up.traits.forEach((t, tk) => existing.traits.set(tk, t))
            } else {
                virtual.upcasts!.set(k, up)
            }
        })
    }
}

export const makeUpcastMap = (
    type: VirtualType,
    traitType: VirtualType,
    ctx: Context
): Map<string, Upcast> | undefined => {
    const res = resolveTypeImpl(type, traitType, ctx)
    if (!res) return undefined
    const genericMap = makeGenericMapOverStructure(type, res.impl.forType)
    const upcasts = new Map()
    upcasts.set('Self', { traits: new Map([[relTypeName(res.trait), res.impl]]) })
    for (const g of res.impl.generics) {
        const gUpcast: Upcast = { traits: new Map() }
        const concreteG = genericMap.get(g.name)
        if (concreteG) {
            for (const b of g.bounds) {
                const gRes = resolveTypeImpl(concreteG, b, ctx)
                if (gRes) {
                    gUpcast.traits.set(relTypeName(gRes.trait), gRes.impl)
                    ctx.moduleStack.at(-1)!.relImports.push(gRes.impl)
                }
            }
        }
        upcasts.set(g.name, gUpcast)
    }
    ctx.moduleStack.at(-1)!.relImports.push(res.impl)
    return upcasts
}
