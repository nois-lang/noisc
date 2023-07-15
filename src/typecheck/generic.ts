import {
    genericToVirtual,
    selfType,
    Typed,
    unknownType,
    VirtualFnType,
    VirtualType,
    virtualTypeToString
} from './index'
import { AstNode } from '../ast'
import { Context, instanceScope } from '../scope'

export const resolveFnGenerics = (fnType: VirtualFnType,
                                  typeArgs: VirtualType[],
                                  args: (AstNode<any> & Partial<Typed>)[]): Map<string, VirtualType> => {
    return new Map(fnType.generics.map((g, i) => {
        const typeArg = typeArgs.at(i)
        if (typeArg) {
            return [g.name, typeArg]
        }
        for (let parI = 0; parI < fnType.paramTypes.length; parI++) {
            const pt = fnType.paramTypes[parI]
            if (virtualTypeToString(pt) === g.name) {
                const arg = args[parI]
                return [g.name, arg.type || unknownType]
            }
        }
        return [g.name, unknownType]
    }))
}

export const resolveInstanceGenerics = (ctx: Context): Map<string, VirtualType> => {
    const instance = instanceScope(ctx)
    if (!instance) return new Map()
    const generics = [instance.selfType, ...instance.def.generics.map(g => genericToVirtual(g, ctx))]
    // TODO: add generics
    return new Map([[selfType.name, instance.selfType]])
}
