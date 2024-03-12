import { Virtual } from '.'
import { Context } from '../scope'
import { InstanceRelation, relTypeName, resolveTypeImpl } from '../scope/trait'
import { VirtualType } from '../typecheck'
import { makeGenericMapOverStructure } from '../typecheck/generic'

export interface Upcast {
    traits: Map<string, InstanceRelation>
}

export const upcast = (
    virtual: Partial<Virtual>,
    type: VirtualType,
    returnTypeResolved: VirtualType,
    ctx: Context
): void => {
    const res = resolveTypeImpl(type, returnTypeResolved, ctx)
    if (res) {
        const genericMap = makeGenericMapOverStructure(type, res.impl.forType)
        virtual.upcasts ??= new Map()
        virtual.upcasts.set('Self', { traits: new Map([[relTypeName(res.trait), res.impl]]) })
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
            virtual.upcasts.set(g.name, gUpcast)
        }
        ctx.moduleStack.at(-1)!.relImports.push(res.impl)
    }
}
