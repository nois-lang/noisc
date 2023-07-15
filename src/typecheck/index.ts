import { Context } from '../scope'
import { Generic, Type } from '../ast/type'
import { idToVid, resolveVid, vidFromString, vidToString, VirtualIdentifier } from '../scope/vid'
import { AstNode } from '../ast'
import { semanticError, SemanticError } from '../semantic/error'
import { resolveGeneric } from '../scope/type'
import { findTypeTraits } from '../scope/trait'

export interface Typed {
    type: VirtualType
}

export type VirtualType = TypeDefType | VirtualVariantType | VirtualFnType | VirtualGeneric | AnyType | UnknownType

export interface TypeDefType {
    kind: 'type-def'
    identifier: VirtualIdentifier
    generics: VirtualGeneric[]
}

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

export const virtualTypeToString = (vt: VirtualType): string => {
    switch (vt.kind) {
        case 'type-def': {
            const t = vidToString(vt.identifier)
            if (vt.generics.length === 0) {
                return t
            } else {
                const generics = vt.generics.map(virtualTypeToString)
                return `${t}<${generics.join(', ')}>`
            }
        }
        case 'variant-type':
            const t = vidToString(vt.identifier)
            if (vt.typeParams.length === 0) {
                return t
            } else {
                const typeParams = vt.typeParams.map(virtualTypeToString)
                return `${t}<${typeParams.join(', ')}>`
            }
        case 'fn-type':
            return `|${vt.paramTypes.map(virtualTypeToString).join(', ')}|: ${virtualTypeToString(vt.returnType)}`
        case 'generic':
            return vt.name
        case 'unknown-type':
            return '<unknown>'
        case 'any-type':
            return '*'
    }
}

export const typeToVirtual = (type: Type, ctx: Context): VirtualType => {
    switch (type.kind) {
        case 'identifier':
            const vid = idToVid(type)
            const ref = resolveVid(vid, ctx)
            if (!ref) {
                return unknownType
            }
            if (ref.def.kind === 'self') {
                return selfType
            } else if (ref.def.kind === 'generic') {
                return genericToVirtual(ref.def, ctx)
            } else if (ref.def.kind === 'trait-def' || ref.def.kind === 'type-def') {
                // TODO: generics
                return { kind: 'type-def', identifier: ref.qualifiedVid, generics: [] }
            } else {
                ctx.errors.push(semanticError(ctx, type, `expected type, got \`${ref.def.kind}\``))
                return unknownType
            }
        case 'fn-type':
            return {
                kind: 'fn-type',
                generics: type.generics.map(g => genericToVirtual(g, ctx)),
                paramTypes: type.paramTypes.map(pt => typeToVirtual(pt, ctx)),
                returnType: typeToVirtual(type.returnType, ctx)
            }
    }
}

export const genericToVirtual = (generic: Generic, ctx: Context): VirtualGeneric =>
    ({ kind: 'generic', name: generic.name.value, bounds: generic.bounds.map(b => typeToVirtual(b, ctx)) })

export const isAssignable = (t: VirtualType, target: VirtualType, ctx: Context): boolean => {
    if (!ctx.config.typecheck) return true

    t = resolveGeneric(t, ctx)

    if (t.kind === anyType.kind || target.kind === anyType.kind) {
        return true
    }
    // TODO: type params
    if ((t.kind === 'variant-type' || t.kind === 'type-def') && (target.kind === 'variant-type' || target.kind === 'type-def')) {
        if (vidToString(t.identifier) === vidToString(target.identifier)) {
            return true
        }
        const traitRefs = findTypeTraits(t.identifier, ctx)
        return traitRefs.some(ref => vidToString(ref.qualifiedVid) === vidToString(target.identifier))
    }
    if (t.kind === 'fn-type' && target.kind === 'fn-type') {
        for (let i = 0; i < target.paramTypes.length; i++) {
            const targetP = target.paramTypes[i]
            const tp = t.paramTypes.at(i)
            if (!tp || !isAssignable(resolveGeneric(tp, ctx), targetP, ctx)) {
                return false
            }
        }
        return isAssignable(target.returnType, t.returnType, ctx)

    }
    return false
}

export const typeError = (node: AstNode<any>, actual: VirtualType, expected: VirtualType, ctx: Context): SemanticError => {
    const message = `\
type error: expected ${virtualTypeToString(expected)}
            got      ${virtualTypeToString(actual)}`
    return semanticError(ctx, node, message)
}
