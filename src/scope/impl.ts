import { Module } from '../ast'
import { ImplDef, KindDef } from '../ast/statement'
import { idToVid, vidFromString, VirtualIdentifier } from './vid'
import { typeToVirtual, VirtualType } from '../typecheck'

export const findImpls = (module: Module): ImplDef[] =>
    module.block.statements.flatMap(s => s.kind !== 'impl-def' ? [] : s)

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

