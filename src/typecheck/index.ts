import { Context, idToVid, vidToString, VirtualIdentifier } from '../scope'
import { todo } from '../util/todo'
import { Type, TypeParam } from '../ast/type'

export interface Typed {
    type: VirtualType
}

export type VirtualType = VirtualVariantType | VirtualFnType

export interface VirtualVariantType {
    kind: 'variant-type'
    identifier: VirtualIdentifier
    typeParams: VirtualTypeParam[]
}

export interface VirtualFnType {
    kind: 'fn-type'
    paramTypes: VirtualType[]
    returnType: VirtualType
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
    } else {
        return todo('VirtualFnType')
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

/**
 * TODO: scope resolution (e.g. make sure Int is std::Int)
 */
export const isAssignable = (t: VirtualType, target: VirtualType, ctx: Context): boolean => {
    if (t.kind === 'variant-type' && target.kind === 'variant-type') {
        return t.identifier.name === target.identifier.name
    }
    return false
}
