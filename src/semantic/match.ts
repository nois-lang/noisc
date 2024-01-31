import { ConPattern, Pattern } from '../ast/match'
import { Name } from '../ast/operand'
import { Context, defKey } from '../scope'
import { idToVid, vidFromScope, vidToString } from '../scope/util'
import { NameDef, resolveVid } from '../scope/vid'
import { VidType, VirtualType, genericToVirtual, virtualTypeToString } from '../typecheck'
import { makeGenericMapOverStructure, resolveType } from '../typecheck/generic'
import { notFoundError, semanticError } from './error'

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
                ctx.errors.push(
                    semanticError(ctx, pattern, `cannot destructure type \`${virtualTypeToString(expectedType)}\``)
                )
                return
            }

            const defs = checkConPattern(expr, expectedType, ctx)
            defs.forEach(p => {
                const nameDef: NameDef = { kind: 'name-def', name: p }
                scope.definitions.set(defKey(nameDef), nameDef)
            })
            break
    }

    if (pattern.name) {
        pattern.name.type = expectedType
        const nameDef: NameDef = { kind: 'name-def', name: pattern.name }
        scope.definitions.set(defKey(nameDef), nameDef)
    }
}

/**
 * @returns a list of definied names within con pattern (recursive included)
 */
const checkConPattern = (pattern: ConPattern, expectedType: VidType, ctx: Context): Name[] => {
    const defs: Name[] = []
    const conVid = idToVid(pattern.identifier)
    const ref = resolveVid(conVid, ctx, ['variant'])

    if (!ref || ref.def.kind !== 'variant') {
        ctx.errors.push(notFoundError(ctx, pattern, vidToString(conVid), 'variant'))
        return []
    }

    const typeDefVid = vidFromScope(ref.vid)
    if (ref.def.typeDef.name.value !== expectedType.identifier.names.at(-1)!) {
        ctx.errors.push(
            semanticError(
                ctx,
                pattern.identifier,
                `cannot destructure type \`${virtualTypeToString(expectedType)}\` into \`${vidToString(typeDefVid)}\``
            )
        )
        return []
    }

    for (const fp of pattern.fieldPatterns) {
        const field = ref.def.variant.fieldDefs.find(fd => fd.name.value === fp.name.value)
        if (!field) {
            ctx.errors.push(notFoundError(ctx, fp, fp.name.value, 'field'))
            return []
        }

        const conGenericMap = makeGenericMapOverStructure(expectedType, {
            kind: 'vid-type',
            identifier: typeDefVid,
            typeArgs: ref.def.typeDef.generics.map(g => genericToVirtual(g, ctx))
        })
        field.name.type = resolveType(field.type!, [conGenericMap], ctx)

        if (fp.pattern) {
            checkPattern(fp.pattern, field.name.type, ctx)
        } else {
            defs.push(field.name)
        }
    }

    return defs
}
