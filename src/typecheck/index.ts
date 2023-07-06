import { Context } from '../scope'
import { Type, TypeParam } from '../ast/type'
import { idToVid, vidFromString, vidToString, VirtualIdentifier } from '../scope/vid'

export interface Typed {
    type: VirtualType
}

export type VirtualType = VirtualVariantType | VirtualFnType | AnyType

export interface VirtualVariantType {
    kind: 'variant-type'
    identifier: VirtualIdentifier
    typeParams: VirtualTypeParam[]
}

export interface VirtualFnType {
    kind: 'fn-type'
    generics: VirtualGeneric[]
    paramTypes: VirtualType[]
    returnType: VirtualType
}

export interface AnyType {
    kind: 'any-type'
}

export const anyType: AnyType = { kind: 'any-type' }

export const unitType: VirtualVariantType = {
    kind: 'variant-type',
    identifier: vidFromString('std::Unit'),
    typeParams: []
}

export type VirtualTypeParam = VirtualType | VirtualGeneric

export interface VirtualGeneric {
    name: string
    bounds: VirtualType[]
}

/**
 * TODO: type params
 */
export const virtualTypeToString = (vt: VirtualType): string => {
    if (vt.kind === 'variant-type') {
        return vidToString(vt.identifier)
    } else if (vt.kind === 'fn-type') {
        return `|${vt.paramTypes.map(virtualTypeToString).join(', ')}|: ${virtualTypeToString(vt.returnType)}`
    } else {
        return '*'
    }
}

export const typeToVirtual = (t: Type): VirtualType => {
    switch (t.kind) {
        case 'variant-type':
            return {
                kind: 'variant-type',
                identifier: idToVid(t.identifier),
                typeParams: t.typeParams.map(typeParamToVirtual)
            }
        case 'fn-type':
            return {
                kind: 'fn-type',
                generics: t.generics.map(g => <VirtualGeneric>typeParamToVirtual(g)),
                paramTypes: t.paramTypes.map(typeToVirtual),
                returnType: typeToVirtual(t.returnType)
            }
    }
}

export const typeParamToVirtual = (tp: TypeParam): VirtualTypeParam => {
    if (tp.kind === 'generic') {
        return { name: tp.name.value, bounds: tp.bounds.map(typeToVirtual) }
    } else {
        return typeToVirtual(tp)
    }
}

export const isAssignable = (t: VirtualType, target: VirtualType, ctx: Context): boolean => {
    if (t.kind === 'any-type' || target.kind === 'any-type') {
        return true
    }
    if (t.kind === 'variant-type' && target.kind === 'variant-type') {
        return t.identifier.name === target.identifier.name
    }
    if (t.kind === 'fn-type' && target.kind === 'fn-type') {
        const selfType = target.generics.some(s => s.name === 'Self')
            ? (<VirtualVariantType>t.paramTypes[0])
            : undefined
        for (let i = 0; i < target.paramTypes.length; i++) {
            const targetP = target.paramTypes[i]
            const tp = t.paramTypes.at(i)
            if (!tp) {
                return false
            }
            if (targetP.kind === 'variant-type' && targetP.identifier.name === 'Self' && selfType) {
                if (!isAssignable(tp, selfType, ctx)) {
                    return false
                }
            } else {
                if (!isAssignable(tp, targetP, ctx)) {
                    return false
                }
            }
        }
        // todo
    }
    return true
}
