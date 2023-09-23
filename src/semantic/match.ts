import { ConPattern, Pattern } from "../ast/match"
import { Name } from "../ast/operand"
import { Context, defKey } from "../scope"
import { idToVid } from "../scope/util"
import { resolveVid } from "../scope/vid"
import { VidType, VirtualType, typeToVirtual, virtualTypeToString } from "../typecheck"
import { notFoundError, semanticError } from "./error"

export const checkPattern = (pattern: Pattern, expectedType: VirtualType, ctx: Context): void => {
    const module = ctx.moduleStack.at(-1)!
    const scope = module.scopeStack.at(-1)!

    switch (pattern.kind) {
        case 'name':
            pattern.type = expectedType
            scope.definitions.set('name' + pattern.value, pattern)
            break
        case 'hole':
            // TODO: typed hole reporting, Haskell style: https://wiki.haskell.org/GHC/Typed_holes
            pattern.type = expectedType
            break
        case 'unary-expr':
            // TODO: check unaryExpr
            break
        case 'operand-expr':
            // TODO: check operandExpr
            break
        case 'con-pattern':
            if (expectedType.kind !== 'vid-type') {
                ctx.errors.push(semanticError(ctx, pattern, `cannot destructure type \`${virtualTypeToString(expectedType)}\``))
                return
            }

            const defs = checkConPattern(pattern, expectedType, ctx)
            if (defs) {
                defs.forEach(p => scope.definitions.set(defKey(p), p))
            }
            break
    }
}

const checkConPattern = (pattern: ConPattern, expectedType: VidType, ctx: Context): Name[] | undefined => {
    const defs: Name[] = []
    const conVid = idToVid(pattern.identifier)
    const ref = resolveVid(conVid, ctx, ['type-con'])

    if (!ref || ref.def.kind !== 'type-con') {
        ctx.errors.push(notFoundError(ctx, pattern, virtualTypeToString(expectedType), 'type constructor'))
        return undefined
    }

    if (ref.def.typeDef.name.value !== expectedType.identifier.names.at(-1)!) {
        ctx.errors.push(semanticError(
            ctx,
            pattern.identifier,
            `cannot destructure type \`${virtualTypeToString(expectedType)}\` into \`${ref.def.typeDef.name.value}\``
        ))
        return undefined
    }

    for (const fp of pattern.fieldPatterns) {
        switch (fp.kind) {
            case 'spread-op':
                // TODO: spreadOp
                break
            case 'field-pattern':
                const field = ref.def.typeCon.fieldDefs.find(fd => fd.name.value === fp.name.value)
                if (!field) return undefined
                field.name.type = typeToVirtual(field.fieldType, ctx)
                if (fp.pattern) {
                    checkPattern(fp.pattern, field.name.type, ctx)
                } else {
                    defs.push(field.name)
                }
                break
        }
    }

    // TODO: check pattern exhaustion, meaning that every field is included in the pattern, or `..` is used otherwise

    return defs
}

