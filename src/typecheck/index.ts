import { Identifier } from '../ast/operand'
import { Type } from '../ast/type'
import { ParseNode } from '../parser'

export type InferredType = InferredTypeDef | { kind: 'ref'; ref: InferredTypeDef }

export type InferredTypeDef = {
    kind: 'inferred'
    bounds: Type[]
    unified?: Type
}

export const makeInferredType = (bounds: Type[] = []): InferredType => ({ kind: 'inferred', bounds })

export const resolveTypeRef = (t: InferredType): InferredTypeDef => (t.kind === 'inferred' ? t : resolveTypeRef(t.ref))

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

export const idEq = (a: Identifier, b: Identifier): boolean => {
    if (a.names.length !== b.names.length) return false
    for (let i = 0; i < a.names.length; i++) {
        if (a.names[i].value !== b.names[i].value) return false
    }
    return true
}

export const idFromString = (str: string, parseNode?: ParseNode): Identifier => {
    return {
        kind: 'identifier',
        parseNode,
        typeArgs: [],
        names: str.split('::').map(n => ({ kind: 'name', value: n }))
    }
}
