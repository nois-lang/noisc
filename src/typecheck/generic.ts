import { AstNode } from '../ast'
import { Context, InstanceScope } from '../scope'
import { fold } from '../util/array'
import { merge } from '../util/map'
import { assert, unreachable } from '../util/todo'
import { VirtualFnType, VirtualType, genericToVirtual, virtualTypeToString } from './index'
import { holeType, selfType } from './type'

export const makeFnGenericMap = (fnType: VirtualFnType, argTypes: VirtualType[]): Map<string, VirtualType> => {
    assert(argTypes.length <= fnType.paramTypes.length, 'fn args > params')
    return argTypes
        .map((argType, i) => {
            const param = fnType.paramTypes[i]
            return makeGenericMapOverStructure(argType, param)
        })
        .reduce((acc, m) => merge(acc, m, (p, _) => p), new Map())
}

export const makeFnTypeArgGenericMap = (fnType: VirtualFnType, typeArgs: VirtualType[]): Map<string, VirtualType> => {
    assert(typeArgs.length <= fnType.generics.length, 'type args > type params')
    return typeArgs
        .map((arg, i) => {
            const param = fnType.generics[i]
            return makeGenericMapOverStructure(arg, param)
        })
        .reduce((acc, m) => merge(acc, m, (p, _) => p), new Map())
}

/**
 * Recursively walk over zipped pair (arg, param) and resolve generic virtual types.
 * In case when both arg and param are fns, walk over [...paramTypes, returnType] and do the same.
 *
 * Examples:
 *   - `makeGenericMapOverStructure(Foo<A, Bar<B>>, Foo<Int, Bar<Char>>)` will produce map [A -> Int, B -> Char]
 *   - `makeGenericMapOverStructure(T, Foo<Int>)`                         will produce map [T -> Foo<Int>]
 */
export const makeGenericMapOverStructure = (arg: VirtualType, param: VirtualType): Map<string, VirtualType> => {
    const map = new Map()
    if (param.kind === 'generic') {
        for (const bound of param.bounds) {
            const resolved = resolveHoleTypesOverStructure(arg, bound)
            if (resolved) {
                arg = resolved
                break
            }
        }
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
            makeGenericMapOverStructure(argType, paramType).forEach((v, k) => map.set(k, v))
        }
        makeGenericMapOverStructure(arg.returnType, param.returnType).forEach((v, k) => map.set(k, v))
    } else {
        const paramTypeArgs = getTypeParams(param)
        const argTypeArgs = getTypeParams(arg)
        for (let i = 0; i < paramTypeArgs.length; i++) {
            const implTypeArg = paramTypeArgs[i]
            const argTypeArg = argTypeArgs.at(i)
            if (argTypeArg) {
                makeGenericMapOverStructure(argTypeArg, implTypeArg).forEach((v, k) => map.set(k, v))
            }
        }
    }
    return map
}

export const resolveHoleTypesOverStructure = (arg: VirtualType, param: VirtualType): VirtualType | undefined => {
    if (arg.kind === 'hole-type') {
        return param
    }

    if (param.kind === 'generic') return
    if (arg.kind === 'unknown-type' || param.kind === 'unknown-type') return

    if (arg.kind === 'fn-type' && param.kind === 'fn-type') {
        for (let i = 0; i < param.paramTypes.length; i++) {
            const paramType = param.paramTypes[i]
            const argType = arg.paramTypes.at(i)
            if (!argType) break
            const resolved = resolveHoleTypesOverStructure(argType, paramType)
            if (resolved) {
                arg.paramTypes[i] = resolved
            }
        }
        const resolved = resolveHoleTypesOverStructure(arg.returnType, param.returnType)
        if (resolved) {
            arg.returnType = resolved
        }
    } else {
        const paramTypeArgs = getTypeParams(param)
        const argTypeArgs = getTypeParams(arg)
        for (let i = 0; i < paramTypeArgs.length; i++) {
            const implTypeArg = paramTypeArgs[i]
            const argTypeArg = argTypeArgs.at(i)
            if (argTypeArg) {
                const resolved = resolveHoleTypesOverStructure(argTypeArg, implTypeArg)
                if (resolved) {
                    argTypeArgs[i] = resolved
                }
            }
        }
    }
    return undefined
}

export const replaceGenericsWithHoles = (type: VirtualType): VirtualType => {
    switch (type.kind) {
        case 'generic':
            return holeType
        case 'vid-type':
            return {
                kind: 'vid-type',
                identifier: type.identifier,
                typeArgs: type.typeArgs.map(replaceGenericsWithHoles)
            }
        case 'fn-type':
            return {
                kind: 'fn-type',
                generics: type.generics,
                paramTypes: type.paramTypes.map(replaceGenericsWithHoles),
                returnType: replaceGenericsWithHoles(type.returnType)
            }
        case 'unknown-type':
        case 'malleable-type':
        case 'hole-type':
            return type
    }
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
 * Will keep generic as-is if not found in generic maps
 */
export const resolveType = (
    virtualType: VirtualType,
    genericMaps: Map<string, VirtualType>[],
    node: AstNode<any>,
    ctx: Context
): VirtualType => {
    return fold(genericMaps, (t, map) => resolveGenericMap(t, map, node, ctx), virtualType)
}

const resolveGenericMap = (
    virtualType: VirtualType,
    genericMap: Map<string, VirtualType>,
    node: AstNode<any>,
    ctx: Context
): VirtualType => {
    switch (virtualType.kind) {
        case 'vid-type':
            return {
                kind: 'vid-type',
                identifier: virtualType.identifier,
                typeArgs: virtualType.typeArgs.map(g => resolveGenericMap(g, genericMap, node, ctx))
            }
        case 'generic':
            const res = genericMap.get(virtualTypeToString(virtualType))
            if (res) {
                return res
            }
            return virtualType
        case 'fn-type':
            return {
                kind: 'fn-type',
                paramTypes: virtualType.paramTypes.map(pt => resolveGenericMap(pt, genericMap, node, ctx)),
                returnType: resolveGenericMap(virtualType.returnType, genericMap, node, ctx),
                generics: virtualType.generics
            }
        case 'hole-type':
        case 'unknown-type':
            return virtualType
    }
    return unreachable()
}
