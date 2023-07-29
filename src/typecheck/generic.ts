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
                const arg = args.at(parI)
                return [g.name, arg?.type || unknownType]
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

export const resolveType = (virtualType: VirtualType, genericMaps: Map<string, VirtualType>[]): VirtualType => {
    switch (virtualType.kind) {
        case 'type-def':
            return {
                kind: 'variant-type',
                identifier: virtualType.identifier,
                typeArgs: virtualType.generics.map(g => resolveType(g, genericMaps))
            }
        case 'variant-type':
            return {
                kind: 'variant-type',
                identifier: virtualType.identifier,
                typeArgs: virtualType.typeArgs.map(g => resolveType(g, genericMaps))
            }
        case 'generic':
            const vt = virtualTypeToString(virtualType)
            let resolved: VirtualType = unknownType
            for (const map of genericMaps) {
                const res = map.get(vt)
                if (res) {
                    resolved = res
                }
            }
            // TODO: push error if type is still unknown
            return resolved
        case 'fn-type':
            // TODO: resolve
            return virtualType
        case 'any-type':
        case 'unknown-type':
            return virtualType
    }
}
