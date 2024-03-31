import { Operand } from '../ast/operand'
import { Generic, Type } from '../ast/type'
import { Context, addError } from '../scope'
import { InstanceRelation, findSuperRelChains, getConcreteTrait } from '../scope/trait'
import { idToVid, vidEq, vidToString } from '../scope/util'
import { VirtualIdentifier, resolveVid, typeKinds } from '../scope/vid'
import { expectedTypeError } from '../semantic/error'
import { zip } from '../util/array'
import { todo } from '../util/todo'
import { holeType, selfType, unknownType } from './type'

export type VirtualType = VidType | VirtualFnType | VirtualGeneric | UnknownType | MalleableType | HoleType

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
    mismatchedBranches?: { then: VirtualType; else?: VirtualType }
    mismatchedMatchClauses?: VirtualType[]
}

/**
 * Type that is resolved to its first usage.
 * Closures are initially defined with this type
 */
export interface MalleableType {
    kind: 'malleable-type'
    operand: Operand
}

export interface HoleType {
    kind: 'hole-type'
}

export interface VirtualGeneric {
    kind: 'generic'
    name: string
    key: string
    bounds: VirtualType[]
}

export interface ConcreteGeneric {
    generic: VirtualGeneric
    impls: InstanceRelation[]
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
            const bounds = vt.bounds.map(virtualTypeToString)
            return `${vt.name}${bounds.length > 0 ? `: ${bounds.join(' + ')}` : ''}`
        case 'hole-type':
            return '_'
        case 'unknown-type':
        case 'malleable-type':
            return '?'
    }
}

export const typeToVirtual = (type: Type, ctx: Context): VirtualType => {
    switch (type.kind) {
        case 'identifier':
            const vid = idToVid(type)
            const ref = resolveVid(vid, ctx, typeKinds)
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
                    identifier: ref.vid,
                    typeArgs: type.typeArgs
                        // self args are for bounds and should be excluded from virtual types
                        .filter(a => a.kind !== 'identifier' || a.names.at(-1)!.value !== 'Self')
                        .map(arg => typeToVirtual(arg, ctx))
                }
            } else {
                addError(ctx, expectedTypeError(ctx, type, ref.def.kind))
                return unknownType
            }
        case 'fn-type':
            return {
                kind: 'fn-type',
                generics: type.generics.map(g => genericToVirtual(g, ctx)),
                paramTypes: type.paramTypes.map(pt => typeToVirtual(pt, ctx)),
                returnType: typeToVirtual(type.returnType, ctx)
            }
        case 'hole':
            return holeType
        case 'type-bounds':
            return todo('type-bounds')
    }
}

export const genericToVirtual = (generic: Generic, ctx: Context): VirtualGeneric => {
    if (!generic.key) {
        generic.key = genericKey(generic, ctx)
    }
    return {
        kind: 'generic',
        name: generic.name.value,
        key: generic.key,
        bounds: generic.bounds.map(b => typeToVirtual(b, ctx))
    }
}

export const genericKey = (generic: Generic, ctx: Context): string => {
    const module = ctx.moduleStack.at(-1)!
    const scopeName = module.scopeStack
        .map(s => {
            switch (s.kind) {
                case 'type':
                case 'fn':
                    switch (s.def.kind) {
                        case 'type-def':
                            return `type_${s.def.name.value}`
                        case 'fn-def':
                            return `fn_${s.def.name.value}`
                        case 'closure-expr':
                            return `closure`
                    }
                case 'instance':
                    switch (s.def.kind) {
                        case 'trait-def':
                            return `trait_${s.def.name.value}`
                        case 'impl-def':
                            return `impl`
                    }
                default:
                    return undefined
            }
        })
        .filter(s => !!s)
        .join('_')
    return `${scopeName}_${generic.name.value}`
}

export const isAssignable = (t: VirtualType, target: VirtualType, ctx: Context): boolean => {
    if (t === target) return true
    if (t.kind === 'unknown-type' || target.kind === 'unknown-type') return true
    if (t.kind === 'hole-type' || target.kind === 'hole-type') return true
    if (t.kind === 'vid-type' && vidToString(t.identifier) === 'std::never::Never') return true

    if (target.kind === 'generic') {
        return target.bounds.every(b => isAssignable(t, b, ctx))
    }
    if (t.kind === 'generic') {
        return t.bounds.some(b => isAssignable(b, target, ctx))
    }

    if (t.kind === 'vid-type' && target.kind === 'vid-type') {
        if (vidEq(t.identifier, target.identifier)) {
            if (t.typeArgs.length !== target.typeArgs.length) return false

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
        return superRelChains
            .map(c => c.at(-1)!)
            .some(superRel => {
                if (vidEq(superRel.implDef.vid, target.identifier)) {
                    const supertype = extractConcreteSupertype(t, target.identifier, ctx)
                    if (!supertype) return false
                    return isAssignable(supertype, target, ctx)
                }
                return false
            })
    }
    if (t.kind === 'fn-type' && target.kind === 'fn-type') {
        for (let i = 0; i < target.paramTypes.length; i++) {
            const tp = t.paramTypes.at(i)
            const targetP = target.paramTypes[i]
            if (!tp || !isAssignable(targetP, tp, ctx)) {
                return false
            }
        }
        return isAssignable(t.returnType, target.returnType, ctx)
    }
    return false
}

export const typeEq = (a: VirtualType, b: VirtualType): boolean => {
    if (a.kind === 'unknown-type' && b.kind === 'unknown-type') return false
    if (a.kind === 'hole-type' && b.kind === 'hole-type') return true
    if (a.kind === 'generic' || b.kind === 'generic') return true
    if (a.kind === 'vid-type' && b.kind === 'vid-type') {
        return (
            vidEq(a.identifier, b.identifier) &&
            a.typeArgs.length === b.typeArgs.length &&
            zip(a.typeArgs, b.typeArgs, (a_, b_) => [a_, b_]).every(([a_, b_]) => typeEq(a_, b_))
        )
    }
    if (a.kind === 'fn-type' && b.kind === 'fn-type') {
        return (
            a.paramTypes.length === b.paramTypes.length &&
            zip(a.paramTypes, b.paramTypes, (a_, b_) => [a_, b_]).every(([a_, b_]) => typeEq(a_, b_)) &&
            typeEq(a.returnType, b.returnType)
        )
    }
    return false
}

/**
 * TODO: better combine logic
 */
export const combine = (a: VirtualType, b: VirtualType, ctx: Context): VirtualType | undefined => {
    if (isAssignable(a, b, ctx)) {
        return a
    }
    if (isAssignable(b, a, ctx)) {
        return b
    }
    return undefined
}

/**
 * Extract concrete type of a supertype.
 * Example: `extractConcreteSupertype(List<Int>, Iterable) -> Iterable<List>`
 * TODO: what if multiple concrete types possible?
 */
export const extractConcreteSupertype = (
    type: VirtualType,
    superVid: VirtualIdentifier,
    ctx: Context
): VirtualType | undefined => {
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
