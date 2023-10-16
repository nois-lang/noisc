import { Generic, Type } from '../ast/type'
import { Context } from '../scope'
import { findSuperRelChains, getConcreteTrait } from '../scope/trait'
import { idToVid, vidEq, vidToString } from '../scope/util'
import { VirtualIdentifier, resolveVid } from '../scope/vid'
import { notFoundError, semanticError } from '../semantic/error'
import { todo } from '../util/todo'
import { selfType, unknownType } from './type'

export type VirtualType = VidType | VirtualFnType | VirtualGeneric | UnknownType

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

export interface UnknownType {
    kind: 'unknown-type'
}

export interface VirtualGeneric {
    kind: 'generic'
    name: string
    bounds: VirtualType[]
}

export const virtualTypeToString = (vt: VirtualType): string => {
    switch (vt.kind) {
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
                // it can be a generic, because not all scopes are available
                // TODO: reproduce
                if (type.typeArgs.length === 0) {
                    return {
                        kind: 'generic',
                        name: type.name.value,
                        bounds: []
                    }
                } else {
                    ctx.errors.push(notFoundError(ctx, type, vidToString(vid)))
                    return unknownType
                }
            }
            if (ref.def.kind === 'self') {
                return selfType
            } else if (ref.def.kind === 'generic') {
                return genericToVirtual(ref.def, ctx)
            } else if (ref.def.kind === 'trait-def' || ref.def.kind === 'type-def') {
                return {
                    kind: 'vid-type',
                    identifier: ref.vid,
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

export const genericToVirtual = (generic: Generic, ctx: Context): VirtualGeneric => {
    return {
        kind: 'generic',
        name: generic.name.value,
        bounds: generic.bounds.map(b => typeToVirtual(b, ctx))
    }
}

export const isAssignable = (t: VirtualType, target: VirtualType, ctx: Context): boolean => {
    if (!ctx.config.typeCheck) return true

    if (t.kind === 'unknown-type' || target.kind === 'unknown-type') {
        return true
    }

    if (t.kind === 'vid-type' && vidToString(t.identifier) === 'std::never::Never') {
        return true
    }

    if (target.kind === 'generic') {
        if (t.kind === 'generic') {
            return t.name === target.name
        }
        return target.bounds.every(b => isAssignable(t, b, ctx))
    }

    if (t.kind === 'vid-type' && target.kind === 'vid-type') {
        if (vidEq(t.identifier, target.identifier) && t.typeArgs.length === target.typeArgs.length) {
            for (let i = 0; i < t.typeArgs.length; i++) {
                const tArg = t.typeArgs[i]
                const targetArg = target.typeArgs[i]
                if (!isAssignable(tArg, targetArg, ctx)) {
                    return false
                }
            }
            return true
        }
        const superRelChains = findSuperRelChains(t.identifier, ctx)
        return superRelChains.some(chain => {
            if (vidEq(chain.at(-1)!.implDef.vid, target.identifier)) {
                const supertype = extractConcreteSupertype(t, target.identifier, ctx)
                if (!supertype) return false
                return isAssignable(supertype, target, ctx)
            }
            return false
        })
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

/**
 * Extract concrete type of a supertype.
 * Example: `extractConcreteSupertype(List<Int>, Iterable) -> Iterable<List>`
 * TODO: what if multiple concrete types possible?
 */
export const extractConcreteSupertype = (type: VirtualType, superVid: VirtualIdentifier, ctx: Context): VirtualType | undefined => {
    if (type.kind !== 'vid-type') return undefined

    const chain = findSuperRelChains(type.identifier, ctx)
        .filter(c => {
            const implType = <VidType>c.at(-1)!.implType
            return vidEq(implType.identifier, superVid)
        })
        .at(0)
    if (!chain) return undefined

    let t: VirtualType = type
    for (const ir of chain) {
        t = getConcreteTrait(t, ir, ctx)
    }
    return t
}
