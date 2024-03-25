import { Virtual } from '.'
import { Context } from '../scope'
import { InstanceRelation, relTypeName, resolveTypeImpl } from '../scope/trait'
import { VirtualType } from '../typecheck'
import { makeGenericMapOverStructure } from '../typecheck/generic'

export type Upcast = { [trait: string]: InstanceRelation }

export const upcast = (virtual: Partial<Virtual>, type: VirtualType, traitType: VirtualType, ctx: Context): void => {
    const upcastMap = makeUpcasts(type, traitType, ctx)
    if (upcastMap) {
        writeUpcasts(virtual, upcastMap)
    }
}

export const makeUpcasts = (type: VirtualType, traitType: VirtualType, ctx: Context): Upcast[] => {
    const res = resolveTypeImpl(type, traitType, ctx)
    if (!res) return []
    const genericMap = makeGenericMapOverStructure(type, res.impl.forType)
    const upcasts = []
    upcasts.push({ [relTypeName(res.trait)]: res.impl })
    for (const g of res.impl.generics) {
        const gUpcast: Upcast = {}
        const concreteG = genericMap.get(g.name)
        if (concreteG) {
            for (const b of g.bounds) {
                const gRes = resolveTypeImpl(concreteG, b, ctx)
                if (gRes) {
                    gUpcast[relTypeName(gRes.trait)] = gRes.impl
                    ctx.moduleStack.at(-1)!.relImports.push(gRes.impl)
                }
            }
        }
        upcasts.push(gUpcast)
    }
    ctx.moduleStack.at(-1)!.relImports.push(res.impl)
    return upcasts
}

const writeUpcasts = (virtual: Partial<Virtual>, upcasts: Upcast[]): void => {
    virtual.upcasts ??= []
    for (let i = 0; i < upcasts.length; i++) {
        const up = upcasts[i]
        if (virtual.upcasts.length > i) {
            for (const [k, v] of Object.entries(up)) {
                virtual.upcasts[i][k] = v
            }
        } else {
            virtual.upcasts.push(up)
        }
    }
}
