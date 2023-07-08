import { Context, semanticError, SemanticError } from '../scope'
import { Generic, Type } from '../ast/type'
import { idToVid, vidFromString, vidToString, VirtualIdentifier } from '../scope/vid'
import { AstNode } from '../ast'

export interface Typed {
    type: VirtualType
}

export type VirtualType = VirtualVariantType | VirtualFnType | AnyType | UnknownType

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

export interface UnknownType {
    kind: 'unknown-type'
}

export const anyType: AnyType = { kind: 'any-type' }

export const unknownType: UnknownType = { kind: 'unknown-type' }

export const selfType: VirtualType = { kind: 'variant-type', identifier: vidFromString('Self'), typeParams: [] }

export const unitType: VirtualVariantType = {
    kind: 'variant-type',
    identifier: vidFromString('std::Unit'),
    typeParams: []
}

export type VirtualTypeParam = VirtualType

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

export const vidToType = (vid: VirtualIdentifier): VirtualType =>
    ({ kind: 'variant-type', identifier: vid, typeParams: [] })

export const typeToVirtual = (type: Type): VirtualType => {
    switch (type.kind) {
        case 'variant-type':
            return {
                kind: 'variant-type',
                identifier: idToVid(type.identifier),
                typeParams: type.typeParams.map(typeToVirtual)
            }
        case 'fn-type':
            return {
                kind: 'fn-type',
                generics: type.generics.map(genericToVirtual),
                paramTypes: type.paramTypes.map(typeToVirtual),
                returnType: typeToVirtual(type.returnType)
            }
    }
}

export const genericToVirtual = (generic: Generic): VirtualGeneric =>
    ({ name: generic.name.value, bounds: generic.bounds.map(typeToVirtual) })

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

export const typeError = (ctx: Context, node: AstNode<any>, expected: VirtualType, actual: VirtualType): SemanticError => {
    const message = `\
type error: expected ${virtualTypeToString(expected)}
            got      ${virtualTypeToString(actual)}`
    return semanticError(ctx, node, message)
}
