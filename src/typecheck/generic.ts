import { genericToVirtual, Typed, VirtualFnType, VirtualType, virtualTypeToString } from './index'
import { AstNode } from '../ast'
import { Context, instanceScope } from '../scope'
import { selfType, unknownType } from './type'

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

export const resolveImplGenerics = (instanceType: VirtualType, implType: VirtualType): Map<string, VirtualType> => {
    const map = new Map()
    if (implType.kind === 'generic') {
        map.set(implType.name, instanceType)
        return map
    }
    const implTypeArgs = getTypeParams(implType)
    const instTypeArgs = getTypeParams(instanceType)
    for (let i = 0; i < implTypeArgs.length; i++) {
        const implTypeArg = implTypeArgs[i]
        const instTypeArg = instTypeArgs.at(i)
        if (instTypeArg) {
            resolveImplGenerics(instTypeArg, implTypeArg).forEach((v, k) => map.set(k, v))
        }
    }
    return map
}

export const getTypeParams = (virtualType: VirtualType): VirtualType[] => {
    switch (virtualType.kind) {
        case 'type-def':
            return virtualType.generics
        case 'variant-type':
            return virtualType.typeArgs
        case 'any-type':
        case 'fn-type':
        case 'generic':
        case 'unknown-type':
            return []
    }
}

export const resolveInstanceGenerics = (ctx: Context): Map<string, VirtualType> => {
    const instance = instanceScope(ctx)
    if (!instance) return new Map()
    const generics = [instance.selfType, ...instance.def.generics.map(g => genericToVirtual(g, ctx))]
    // TODO: add generics
    return new Map([[selfType.name, instance.selfType]])
}
