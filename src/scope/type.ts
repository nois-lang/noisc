import { Context, instanceScope } from './index'
import { selfType, typeToVirtual, VirtualType } from '../typecheck'
import { resolveVid, vidFromString, vidToString } from './vid'

export const resolveGeneric = (generic: VirtualType, ctx: Context): VirtualType => {
    if (generic.kind !== 'generic') return generic
    // TODO: generics
    if (generic.name === selfType.name) {
        const scope = instanceScope(ctx)
        switch (scope?.type) {
            case 'trait-def':
                return { kind: 'type-def', identifier: vidFromString(scope.traitDef.name.value), generics: [] }
            case 'impl-def':
                if (scope.implDef.forTrait) {
                    return typeToVirtual(scope.implDef.forTrait, ctx)
                } else {
                    const identifier = vidFromString(scope.implDef.name.value)
                    const ref = resolveVid(identifier, ctx)
                    if (!ref) {
                        throw Error(`no ref ${vidToString(identifier)}`)
                    }
                    if (ref.def.kind !== 'type-def') {
                        throw Error(`generic resolved to \`${ref.def.kind}\``)
                    }
                    return { kind: 'type-def', identifier: ref.qualifiedVid, generics: [] }
                }
            case undefined:
                break
        }
    }
    return generic
}
