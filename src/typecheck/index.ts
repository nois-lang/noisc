import { AstNode } from '../ast'
import { Generic, Type } from '../ast/type'
import { Context } from '../scope'
import { findTypeTraits } from '../scope/trait'
import { idToVid, vidToString } from '../scope/util'
import { VirtualIdentifier, resolveVid } from '../scope/vid'
import { SemanticError, semanticError } from '../semantic/error'
import { todo } from '../util/todo'
import { anyType, selfType, unknownType } from './type'

export interface Typed {
    type: VirtualType
}

export type VirtualType = TypeDefType | VidType | VirtualFnType | VirtualGeneric | AnyType | UnknownType

export interface TypeDefType {
    kind: 'type-def'
    identifier: VirtualIdentifier
    generics: VirtualGeneric[]
}

export interface VidType {
    kind: 'vid-type'
    identifier: VirtualIdentifier
    typeArgs: VirtualType[]
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
        case 'vid-type': {
            const t = vidToString(vt.identifier)
            if (vt.typeArgs.length === 0) {
                return t
            } else {
                const typeArgs = vt.typeArgs.map(virtualTypeToString)
                return `${t}<${typeArgs.join(', ')}>`
            }
        }
        case 'fn-type': {
            const t = `|${vt.paramTypes.map(virtualTypeToString).join(', ')}|: ${virtualTypeToString(vt.returnType)}`
            if (vt.generics.length === 0) {
                return t
            } else {
                const generics = vt.generics.map(virtualTypeToString)
                return `<${generics.join(', ')}>${t}`
            }
        }
        case 'generic':
            return vt.name
        case 'any-type':
            return '*'
        case 'unknown-type':
            return '?'
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
                return {
                    kind: 'vid-type',
                    identifier: ref.qualifiedVid,
                    typeArgs: type.typeArgs.map(arg => typeToVirtual(arg, ctx))
                }
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
        case 'type-bounds':
            return todo('type-bounds')
    }
}

export const genericToVirtual = (generic: Generic, ctx: Context): VirtualGeneric =>
    ({ kind: 'generic', name: generic.name.value, bounds: generic.bounds.map(b => typeToVirtual(b, ctx)) })

export const isAssignable = (t: VirtualType, target: VirtualType, ctx: Context): boolean => {
    if (!ctx.config.typeCheck) return true

    if (t.kind === anyType.kind || target.kind === anyType.kind) {
        return true
    }
    // TODO: type params
    if (t.kind === 'type-def' || target.kind === 'type-def') {
        todo('type-def in typecheck')
    }
    if (t.kind === 'vid-type' && target.kind === 'vid-type') {
        if (vidToString(t.identifier) === vidToString(target.identifier)) {
            for (let i = 0; i < t.typeArgs.length; i++) {
                const tArg = t.typeArgs[i]
                const targetArg = target.typeArgs[i]
                if (!isAssignable(tArg, targetArg, ctx)) {
                    return false
                }
            }
            return true
        }
        const traitRefs = findTypeTraits(t.identifier, ctx)
        return traitRefs.some(ref => vidToString(ref.qualifiedVid) === vidToString(target.identifier))
    }
    if (t.kind === 'fn-type' && target.kind === 'fn-type') {
        for (let i = 0; i < target.paramTypes.length; i++) {
            const targetP = target.paramTypes[i]
            const tp = t.paramTypes.at(i)
            if (!tp || !isAssignable(tp, targetP, ctx)) {
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
