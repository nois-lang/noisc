import { AstNode } from '../ast'
import { Context, InstanceScope } from '../scope'
import { merge } from '../util/map'
import { VirtualFnType, VirtualType, genericToVirtual, virtualTypeToString } from './index'
import { selfType } from './type'

export const resolveFnGenerics = (
    fnType: VirtualFnType,
    argTypes: VirtualType[],
    typeArgs: VirtualType[] = [],
): Map<string, VirtualType> => {
    if (typeArgs.length > 0) {
        return new Map<string, VirtualType>(fnType.generics.map((g, i) => [g.name, typeArgs[i]]))
    }
    return argTypes
        .map((argType, i) => {
            const param = fnType.paramTypes.at(i)
            if (!param) {
                throw Error('fn args >= params')
            }
            return resolveGenericsOverStructure(argType, param)
        })
        .reduce((acc, m) => merge(acc, m, (p, _) => p), new Map<string, VirtualType>())
}

/**
 * Recursively walk over zipped pair (arg, param) and resolve generic virtual types.
 * In case when both arg and param are fns, walk over [...paramTypes, returnType] and do the same.
 *
 * Examples: 
 *   - `resolveGenerics(Foo<A, Bar<B>>, Foo<Int, Bar<Char>>)` will produce map [A -> Int, B -> Char]
 *   - `resolveGenerics(T, Foo<Int>)`                         will produce map [T -> Foo<Int>]
 */
export const resolveGenericsOverStructure = (arg: VirtualType, param: VirtualType): Map<string, VirtualType> => {
    const map = new Map()
    if (param.kind === 'generic') {
        map.set(param.name, arg)
        return map
    }
    if (arg.kind === 'unknown-type' || param.kind === 'unknown-type') {
        return map
    }
    if (arg.kind === 'fn-type' && param.kind === 'fn-type') {
        for (let i = 0; i < param.paramTypes.length; i++) {
            const paramType = param.paramTypes[i]
            const argType = arg.paramTypes.at(i)
            if (!argType) break
            resolveGenericsOverStructure(argType, paramType).forEach((v, k) => map.set(k, v))
        }
        resolveGenericsOverStructure(arg.returnType, param.returnType).forEach((v, k) => map.set(k, v))
    } else {
        const paramTypeArgs = getTypeParams(param)
        const argTypeArgs = getTypeParams(arg)
        for (let i = 0; i < paramTypeArgs.length; i++) {
            const implTypeArg = paramTypeArgs[i]
            const argTypeArg = argTypeArgs.at(i)
            if (argTypeArg) {
                resolveGenericsOverStructure(argTypeArg, implTypeArg).forEach((v, k) => map.set(k, v))
            }
        }
    }
    return map
}

export const getTypeParams = (virtualType: VirtualType): VirtualType[] => {
    switch (virtualType.kind) {
        case 'vid-type':
            return virtualType.typeArgs
        default:
            return []
    }
}

export const instanceGenericMap = (instScope: InstanceScope, ctx: Context): Map<string, VirtualType> => {
    const generics = instScope.def.generics.map(g => {
        const vg = genericToVirtual(g, ctx)
        return <const>[vg.name, vg]
    })
    return new Map([[selfType.name, instScope.selfType], ...generics])
}

/**
 * Recursively go through type and it's arguments and replace generics with types found in @param genericMaps.
 * Set type to unknown if not found
 */
export const resolveType = (
    virtualType: VirtualType,
    genericMaps: Map<string, VirtualType>[],
    node: AstNode<any>,
    ctx: Context
): VirtualType => {
    switch (virtualType.kind) {
        case 'vid-type':
            return {
                kind: 'vid-type',
                identifier: virtualType.identifier,
                typeArgs: virtualType.typeArgs.map(g => resolveType(g, genericMaps, node, ctx))
            }
        case 'generic':
            // try to resolve generic with maps, in case of no matches keep as-is, it might get resolved later
            const vt = virtualTypeToString(virtualType)
            let resolved: VirtualType = virtualType
            for (const map of genericMaps) {
                const res = map.get(vt)
                if (res) {
                    resolved = res
                }
            }
            return resolved
        case 'fn-type':
            return {
                kind: 'fn-type',
                paramTypes: virtualType.paramTypes.map(pt => resolveType(pt, genericMaps, node, ctx)),
                returnType: resolveType(virtualType.returnType, genericMaps, node, ctx),
                generics: virtualType.generics
            }
        case 'unknown-type':
            return virtualType
    }
}
