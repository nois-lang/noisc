import { Context } from '../scope'
import { Generic, Type } from '../ast/type'
import { idToVid, vidFromString, vidToString, VirtualIdentifier } from '../scope/vid'
import { AstNode } from '../ast'
import { semanticError, SemanticError } from '../semantic/error'

export interface Typed {
    type: VirtualType
}

export type VirtualType = VirtualVariantType | VirtualFnType | VirtualGeneric | AnyType | UnknownType

export interface VirtualVariantType {
    kind: 'variant-type'
    identifier: VirtualIdentifier
    typeParams: VirtualType[]
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

export const selfType: VirtualGeneric = { kind: 'generic', name: 'Self', bounds: [] }

export const unitType: VirtualVariantType = {
    kind: 'variant-type',
    identifier: vidFromString('std::Unit'),
    typeParams: []
}

export interface VirtualGeneric {
    kind: 'generic',
    name: string
    bounds: VirtualType[]
}

/**
 * TODO: type params
 */
export const virtualTypeToString = (vt: VirtualType): string => {
    switch (vt.kind) {
        case 'variant-type':
            return vidToString(vt.identifier)
        case 'fn-type':
            return `|${vt.paramTypes.map(virtualTypeToString).join(', ')}|: ${virtualTypeToString(vt.returnType)}`
        case 'generic':
            return vt.name
        case 'unknown-type':
            return '<unknown>'
        default:
            return '*'
    }
}

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
    ({ kind: 'generic', name: generic.name.value, bounds: generic.bounds.map(typeToVirtual) })

export const isAssignable = (t: VirtualType, target: VirtualType, ctx: Context): boolean => {
    if (t.kind === anyType.kind || target.kind === anyType.kind) {
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
