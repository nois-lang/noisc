import { ConPattern, Pattern } from '../ast/match'
import { Name } from '../ast/operand'
import { Context, addError, defKey } from '../scope'
import { idToVid, vidToString } from '../scope/util'
import { NameDef, resolveVid } from '../scope/vid'
import { VidType, VirtualFnType, VirtualType, isAssignable } from '../typecheck'
import { makeGenericMapOverStructure, resolveType } from '../typecheck/generic'
import { unknownType } from '../typecheck/type'
import {
    nonDestructurableTypeError,
    notFoundError,
    privateAccessError,
    typeError,
    unexpectedRefutablePatternError
} from './error'
import { checkOperand } from './expr'

export const checkPattern = (
    pattern: Pattern,
    expectedType: VirtualType,
    ctx: Context,
    refutable: boolean = true
): void => {
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
        case 'operand-expr':
            if (!refutable) {
                addError(ctx, unexpectedRefutablePatternError(ctx, pattern.expr))
                break
            }
            checkOperand(expr.operand, ctx)
            expr.type = expr.operand.type
            break
        case 'con-pattern':
            if (expectedType.kind !== 'vid-type') {
                addError(ctx, nonDestructurableTypeError(ctx, pattern.expr, expectedType))
                break
            }

            const defs = checkConPattern(expr, expectedType, ctx, refutable)
            defs.forEach(p => {
                const nameDef: NameDef = { kind: 'name-def', name: p }
                scope.definitions.set(defKey(nameDef), nameDef)
            })
            expr.type ??= unknownType
            break
    }

    if (pattern.name) {
        pattern.name.type = expr.type
        const nameDef: NameDef = { kind: 'name-def', name: pattern.name }
        scope.definitions.set(defKey(nameDef), nameDef)
    }

    if (expectedType.kind !== 'malleable-type') {
        if (!isAssignable(expectedType, expr.type!, ctx)) {
            addError(ctx, typeError(ctx, pattern.expr, expr.type!, expectedType))
        }
    }
}

/**
 * @returns a list of defined names within con pattern (including recursive)
 */
const checkConPattern = (
    pattern: ConPattern,
    expectedType: VidType,
    ctx: Context,
    refutable: boolean = true
): Name[] => {
    const defs: Name[] = []
    const conVid = idToVid(pattern.identifier)
    const ref = resolveVid(conVid, ctx, ['variant'])

    if (!ref || ref.def.kind !== 'variant') {
        addError(ctx, notFoundError(ctx, pattern, vidToString(conVid), 'variant'))
        return []
    }

    if (ref.def.typeDef.name.value !== expectedType.identifier.names.at(-1)!) {
        addError(ctx, nonDestructurableTypeError(ctx, pattern, expectedType))
        return []
    }

    if (!refutable && ref.def.typeDef.variants.length > 1) {
        addError(ctx, unexpectedRefutablePatternError(ctx, pattern))
    }

    const conType = <VirtualFnType>ref.def.variant.type
    const conGenericMap = makeGenericMapOverStructure(expectedType, conType.returnType)
    pattern.type = resolveType(conType.returnType, [conGenericMap], ctx)

    for (const fp of pattern.fieldPatterns) {
        const field = ref.def.variant.fieldDefs.find(fd => fd.name.value === fp.name.value)
        if (!field) {
            addError(ctx, notFoundError(ctx, fp, fp.name.value, 'field'))
            return []
        }
        if (!field.pub && ctx.moduleStack.at(-1)! !== ref.module) {
            addError(ctx, privateAccessError(ctx, fp, 'field', fp.name.value))
        }

        field.name.type = resolveType(field.type!, [conGenericMap], ctx)

        if (fp.pattern) {
            checkPattern(fp.pattern, field.name.type, ctx, refutable)
        } else {
            defs.push(field.name)
        }
    }

    return defs
}
