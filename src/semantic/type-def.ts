import { Type } from "../ast/type";

export const typeNames = (type: Type): string[] => {
    switch (type.kind) {
        case 'identifier': {
            return [type.name.value, ...type.typeArgs.flatMap(a => typeNames(a))]
        }
        case 'fn-type': {
            // TODO: include fn types in the list of names
            return []
        }
        case 'type-bounds': {
            // TODO: include type bounds in the list of names
            return []
        }
    }
}
