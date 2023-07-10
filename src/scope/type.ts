import { Context, instanceScope } from './index'
import { selfType, typeToVirtual, VirtualType } from '../typecheck'
import { resolveVid, vidFromString, vidToString } from './vid'
import { VariantType } from '../ast/type'

export const resolveGeneric = (generic: VirtualType, ctx: Context): VirtualType => {
    if (generic.kind !== 'generic') return generic
    // TODO: generics
    if (generic.name === selfType.name) {
        const scope = instanceScope(ctx)
        switch (scope?.type) {
            case 'kind-def':
                return { kind: 'type-def', identifier: vidFromString(scope.kindDef.name.value), generics: [] }
            case 'impl-def':
                if (scope.implDef.forKind) {
                    return typeToVirtual(<VariantType>scope.implDef.forKind)
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
