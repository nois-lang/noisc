import { ConPattern, Pattern } from "../ast/match"
import { Name } from "../ast/operand"
import { Context, defKey } from "../scope"
import { idToVid, vidToString } from "../scope/util"
import { NameDef, resolveVid } from "../scope/vid"
import { VidType, VirtualType, typeToVirtual, virtualTypeToString } from "../typecheck"
import { notFoundError, semanticError } from "./error"

export const checkPattern = (pattern: Pattern, expectedType: VirtualType, ctx: Context): void => {
    const module = ctx.moduleStack.at(-1)!
    const scope = module.scopeStack.at(-1)!
    const expr = pattern.expr

    switch (expr.kind) {
        case 'name':
            expr.type = expectedType
            scope.definitions.set('name' + expr.value, { kind: 'name-def', name: expr })
            break
        case 'hole':
            // TODO: typed hole reporting, Haskell style: https://wiki.haskell.org/GHC/Typed_holes
            expr.type = expectedType
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

            const defs = checkConPattern(expr, expectedType, ctx)
            if (defs) {
                defs.forEach(p => {
                    const nameDef: NameDef = { kind: 'name-def', name: p }
                    scope.definitions.set(defKey(nameDef), nameDef)
                })
            }
            break
    }

    if (pattern.name) {
        pattern.name.type = expectedType
        const nameDef: NameDef = { kind: 'name-def', name: pattern.name }
        scope.definitions.set(defKey(nameDef), nameDef)
    }
}

const checkConPattern = (pattern: ConPattern, expectedType: VidType, ctx: Context): Name[] | undefined => {
    const defs: Name[] = []
    const conVid = idToVid(pattern.identifier)
    const ref = resolveVid(conVid, ctx, ['type-con'])

    if (!ref || ref.def.kind !== 'type-con') {
        ctx.errors.push(notFoundError(ctx, pattern, vidToString(conVid), 'type constructor'))
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
        const field = ref.def.typeCon.fieldDefs.find(fd => fd.name.value === fp.name.value)
        if (!field) return undefined
        field.name.type = typeToVirtual(field.fieldType, ctx)
        if (fp.pattern) {
            checkPattern(fp.pattern, field.name.type, ctx)
        } else {
            defs.push(field.name)
        }
    }

    // TODO: check pattern exhaustion, meaning that every field is included in the pattern, or `..` is used otherwise

    return defs
}

