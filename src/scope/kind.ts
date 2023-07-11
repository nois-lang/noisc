import { idToVid, resolveVid, vidFromString, vidToString, VirtualIdentifier, VirtualIdentifierMatch } from './vid'
import { Context } from './index'
import { ImplDef, KindDef, Statement } from '../ast/statement'
import { typeToVirtual, VirtualType } from '../typecheck'
import { defaultImportedVids } from './std'

export const findImplKindsWithFn = (typeVid: VirtualIdentifier, methodName: string, ctx: Context): VirtualIdentifierMatch[] => {
    const found: VirtualIdentifierMatch[] = []
    const kindRefs = findTypeKinds(typeVid, ctx)
    for (const kindRef of kindRefs) {
        if (kindRef.def.kind !== 'kind-def') continue
        for (let s of kindRef.def.block.statements) {
            if (s.kind !== 'fn-def') continue
            if (s.name.value === methodName) {
                found.push(kindRef)
            }
        }
    }
    return found
}

/**
 * Find all impls for specified type, available in the current scope
 */
export const findTypeKinds = (typeVid: VirtualIdentifier, ctx: Context): VirtualIdentifierMatch[] => {
    const checkStatement = (s: Statement): void => {
        if (s.kind !== 'impl-def') return
        if (!s.forKind && s.name.value === vidToString(typeVid)) {
            // TODO: type impl
        }
        const targetRef = resolveVid(getImplTargetVid(s), ctx)
        if (targetRef && vidToString(targetRef.qualifiedVid) === vidToString(typeVid)) {
            const kindRef = resolveVid(vidFromString(s.name.value), ctx)
            if (kindRef && kindRef.def.kind === 'kind-def') {
                kinds.push({ qualifiedVid: kindRef.qualifiedVid, def: kindRef.def })
            }
        }
    }

    const kinds: VirtualIdentifierMatch[] = []
    const module = ctx.moduleStack.at(-1)!
    module.block.statements.forEach(checkStatement)

    for (let useExpr of [...defaultImportedVids(), ...module.references!]) {
        // TODO
    }

    return kinds
}

export const getImplTargetVid = (implDef: ImplDef): VirtualIdentifier => {
    if (implDef.forKind) {
        if (implDef.forKind.kind !== 'variant-type') throw Error('non variant type as impl target')
        return idToVid(implDef.forKind.identifier)
    } else {
        return vidFromString(implDef.name.value)
    }
}

export const getImplTargetType = (implDef: ImplDef): VirtualType => {
    if (implDef.forKind) {
        if (implDef.forKind.kind !== 'variant-type') throw Error('non variant type as impl target')
        return typeToVirtual(implDef.forKind)
    } else {
        return { kind: 'type-def', identifier: vidFromString(implDef.name.value), generics: [] }
    }
}

export const resolveSelfType = (def: ImplDef | KindDef): VirtualType => {
    return def.kind === 'impl-def'
        ? getImplTargetType(def)
        : { kind: 'type-def', identifier: vidFromString(def.name.value), generics: [] }
}

