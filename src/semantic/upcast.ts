import { Virtual } from '.'
import { Operand } from '../ast/operand'
import { Context } from '../scope'
import { InstanceRelation, relTypeName, resolveTypeImpl } from '../scope/trait'
import { VirtualType } from '../typecheck'
import { makeGenericMapOverStructure } from '../typecheck/generic'
import { zip } from '../util/array'

export interface Upcast {
    self: { [trait: string]: InstanceRelation }
    generics: Upcast[]
}

export interface UpcastFn {
    paramUpcasts: (Upcast | undefined)[]
    returnUpcast?: Upcast
}

export const upcast = (operand: Operand, type: VirtualType, traitType: VirtualType, ctx: Context): void => {
    if (type.kind === 'fn-type' && traitType.kind === 'fn-type') {
        // TODO: why params are swapped?
        const paramUpcasts = zip(type.paramTypes, traitType.paramTypes, (a, p) => makeUpcast(p, a, ctx))
        const returnUpcast = makeUpcast(type.returnType, traitType.returnType, ctx)
        if (paramUpcasts.some(p => p) || returnUpcast) {
            const upcastFn = { paramUpcasts, returnUpcast }
            // TODO: less ugly, upcastFn should only apply to method defs?
            if (operand.kind === 'operand-expr') {
                operand.operand.upcastFn = upcastFn
            } else {
                operand.upcastFn = upcastFn
            }
        }
        return
    }
    const upcastMap = makeUpcast(type, traitType, ctx)
    if (upcastMap) {
        writeUpcast(operand, upcastMap)
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
