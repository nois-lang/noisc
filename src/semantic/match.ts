import { ConPattern, Pattern } from '../ast/match'
import { Name } from '../ast/operand'
import { Context, addError, defKey } from '../scope'
import { idToVid, vidFromScope, vidToString } from '../scope/util'
import { NameDef, resolveVid } from '../scope/vid'
import { VidType, VirtualType, genericToVirtual, virtualTypeToString } from '../typecheck'
import { makeGenericMapOverStructure, resolveType } from '../typecheck/generic'
import { notFoundError, semanticError } from './error'
import { checkOperand } from './expr'

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
            if (expr.prefixOp && expr.prefixOp?.kind !== 'neg-op') {
                addError(ctx, semanticError(ctx, expr.prefixOp, `unexpected operator \`${expr.prefixOp.kind}\``))
            }
            if (expr.postfixOp) {
                addError(ctx, semanticError(ctx, expr.postfixOp, `unexpected operator`))
            }
            checkOperand(expr.operand, ctx)
            expr.type = expr.operand.type
            break
        case 'operand-expr':
            checkOperand(expr.operand, ctx)
            expr.type = expr.operand.type
            break
        case 'con-pattern':
            if (expectedType.kind !== 'vid-type') {
                addError(
                    ctx,
                    semanticError(ctx, pattern, `cannot destructure type \`${virtualTypeToString(expectedType)}\``)
                )
                break
            }

            const defs = checkConPattern(expr, expectedType, ctx)
            defs.forEach(p => {
                const nameDef: NameDef = { kind: 'name-def', name: p }
                scope.definitions.set(defKey(nameDef), nameDef)
            })
            break
    }

    // TODO expectedType is assignable to expr.type
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
        addError(ctx, notFoundError(ctx, pattern, vidToString(conVid), 'variant'))
        return []
    }

    const typeDefVid = vidFromScope(ref.vid)
    if (ref.def.typeDef.name.value !== expectedType.identifier.names.at(-1)!) {
        const msg = `cannot destructure type \`${virtualTypeToString(expectedType)}\` into \`${vidToString(
            typeDefVid
        )}\``
        addError(ctx, semanticError(ctx, pattern.identifier, msg))
        return []
    }

    for (const fp of pattern.fieldPatterns) {
        const field = ref.def.variant.fieldDefs.find(fd => fd.name.value === fp.name.value)
        if (!field) {
            addError(ctx, notFoundError(ctx, fp, fp.name.value, 'field'))
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
