import { Virtual } from '.'
import { Context } from '../scope'
import { InstanceRelation, relTypeName, resolveTypeImpl } from '../scope/trait'
import { VirtualType } from '../typecheck'
import { makeGenericMapOverStructure } from '../typecheck/generic'

export interface Upcast {
    self: { [trait: string]: InstanceRelation }
    generics: Upcast[]
}

export const upcast = (virtual: Partial<Virtual>, type: VirtualType, traitType: VirtualType, ctx: Context): void => {
    const upcastMap = makeUpcast(type, traitType, ctx)
    if (upcastMap) {
        writeUpcast(virtual, upcastMap)
    }
}

export const makeUpcast = (type: VirtualType, traitType: VirtualType, ctx: Context): Upcast | undefined => {
    const res = resolveTypeImpl(type, traitType, ctx)
    if (!res) return undefined
    const genericMap = makeGenericMapOverStructure(type, res.impl.forType)
    const upcast: Upcast = { self: { [relTypeName(res.trait)]: res.impl }, generics: [] }
    for (const g of res.impl.generics) {
        const gUpcast: Upcast = { self: {}, generics: [] }
        const concreteG = genericMap.get(g.key)
        if (concreteG) {
            for (const b of g.bounds) {
                const gUp = makeUpcast(concreteG, b, ctx)
                if (gUp) {
                    upcast.generics.push(gUp)
                } else {
                    // upcast.generics.push({ self: {}, generics: [] })
                }
            }
        }
        upcast.generics.push(gUpcast)
    }
    ctx.moduleStack.at(-1)!.relImports.push(res.impl)
    return upcast
}

const writeUpcast = (virtual: Partial<Virtual>, upcast: Upcast): void => {
    virtual.upcasts ??= []
    virtual.upcasts.push(upcast)
}
