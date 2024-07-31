import { Identifier } from '../ast/operand'
import { Type } from '../ast/type'

export type InferredType = {
    kind: 'inferred'
    bounds: Type[]
    unified?: Type
}

export const typeToString = (t: Type): string => {
    switch (t.kind) {
        case 'identifier':
            return idToString(t)
        case 'fn-type':
            const main = `|${t.paramTypes.map(typeToString).join(', ')}|: ${typeToString(t.returnType)}`
            const typeArgs = t.generics.length > 0 ? `<${t.generics.map(g => g.name.value).join(', ')}>` : ''
            return typeArgs + main
        case 'hole':
            return '_'
    }
}

export const idToString = (id: Identifier): string => {
    const main = id.names.map(n => n.value).join('::')
    const typeArgs = id.typeArgs.length > 0 ? `<${id.typeArgs.map(typeToString).join(', ')}>` : ''
    return main + typeArgs
}
