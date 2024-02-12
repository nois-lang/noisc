import { Type } from '../ast/type'

export const typeNames = (type: Type): string[] => {
    switch (type.kind) {
        case 'identifier': {
            return [type.names.at(-1)!.value, ...type.typeArgs.flatMap(t => typeNames(t))]
        }
        case 'fn-type': {
            return [
                ...type.generics.flatMap(g => [g.name.value, ...g.bounds.flatMap(typeNames)]),
                ...type.paramTypes.flatMap(typeNames),
                ...typeNames(type.returnType)
            ]
        }
        case 'type-bounds': {
            return type.bounds.flatMap(typeNames)
        }
        case 'hole': {
            return []
        }
    }
}
