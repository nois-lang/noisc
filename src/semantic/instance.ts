import { checkCallArgs, checkType } from '.'
import { BinaryExpr } from '../ast/expr'
import { CallOp } from '../ast/op'
import { Identifier, Operand, identifierFromOperand } from '../ast/operand'
import { Context, addError, instanceScope } from '../scope'
import { getInstanceForType, resolveGenericImpls, resolveMethodImpl } from '../scope/trait'
import { vidToString } from '../scope/util'
import { MethodDef, resolveVid } from '../scope/vid'
import { VirtualFnType, VirtualType, combine, genericToVirtual, typeToVirtual, virtualTypeToString } from '../typecheck'
import {
    instanceGenericMap,
    makeFnGenericMap,
    makeFnTypeArgGenericMap,
    makeGenericMapOverStructure,
    resolveType
} from '../typecheck/generic'
import { selfType, unknownType } from '../typecheck/type'
import { assert } from '../util/todo'
import { notFoundError, semanticError } from './error'
import { checkExpr, checkOperand } from './expr'

export const checkAccessExpr = (binaryExpr: BinaryExpr, ctx: Context): void => {
    const lOperand = binaryExpr.lOperand
    const rOperand = binaryExpr.rOperand
    if (rOperand.kind === 'identifier') {
        binaryExpr.type = checkFieldAccessExpr(lOperand, rOperand, ctx) ?? unknownType
        return
    }
    if (rOperand.kind === 'unary-expr') {
        if (rOperand.op.kind === 'call-op') {
            binaryExpr.type = checkMethodCallExpr(lOperand, rOperand.operand, rOperand.op, ctx) ?? unknownType
            return
        } else {
            checkOperand(rOperand, ctx)
            binaryExpr.type = rOperand.type
            return
        }
    }
    addError(ctx, semanticError(ctx, rOperand, `unexpected operand \`${rOperand.kind}\``))
    binaryExpr.type = unknownType
}

const checkFieldAccessExpr = (lOp: Operand, field: Identifier, ctx: Context): VirtualType | undefined => {
    checkOperand(lOp, ctx)
    // TODO: make sure no type args specified; check other identifier uses also
    if (field.names.length > 1) {
        addError(ctx, semanticError(ctx, field, `expected field name`))
        return
    }
    if (!(lOp.type?.kind === 'vid-type')) {
        const msg = `expected variant type, got \`${virtualTypeToString(lOp.type ?? unknownType)}\``
        addError(ctx, semanticError(ctx, field, msg))
        return
    }
    const typeVid = lOp.type.identifier
    const typeRef = resolveVid(typeVid, ctx, ['type-def'])
    if (!typeRef || typeRef.def.kind !== 'type-def') {
        addError(ctx, notFoundError(ctx, lOp, vidToString(typeVid), 'type'))
        return
    }
    const typeDef = typeRef.def
    const fieldName = field.names.at(-1)!.value
    // check that every type variant has such field
    const matchedCount = typeDef.variants.filter(v => v.fieldDefs.find(f => f.name.value === fieldName)).length
    if (matchedCount === 0) {
        const msg = `field \`${fieldName}\` is not defined in type \`${vidToString(typeRef.vid)}\``
        addError(ctx, semanticError(ctx, field, msg))
        return
    } else {
        if (matchedCount !== typeDef.variants.length) {
            const msg = `field \`${fieldName}\` is not defined in all variants of type \`${vidToString(typeRef.vid)}\``
            addError(ctx, semanticError(ctx, field, msg))
            return
        }
    }
    // if field is defined in multiple variants, make sure their type is equal
    // normaly single variant types use field access, but there is no reason to restrict multiple variants sharing the
    // same field
    const fieldCandidates = typeDef.variants
        .map(v => v.fieldDefs.find(f => f.name.value === fieldName))
        .filter(f => !!f)
        .map(f => f!)
    assert(fieldCandidates.length > 0)
    const fieldType = fieldCandidates[0].type!
    if (!fieldCandidates.every(f => !!combine(fieldType, f.type!, ctx))) {
        const msg = `field \`${fieldName}\` is not defined in every variant of type \`${vidToString(typeRef.vid)}\``
        addError(ctx, semanticError(ctx, field, msg))
        return
    }

    const sameModule = ctx.moduleStack.at(-1)! === typeRef.module
    if (!sameModule && !fieldCandidates.every(f => f.pub)) {
        const msg =
            fieldCandidates.length === 1
                ? `field \`${fieldName}\` is private in type \`${vidToString(typeRef.vid)}\``
                : `field \`${fieldName}\` is private in some variants of type \`${vidToString(typeRef.vid)}\``
        addError(ctx, semanticError(ctx, field, msg))
        return
    }

    const conGenericMap = makeGenericMapOverStructure(lOp.type, {
        kind: 'vid-type',
        identifier: typeRef.vid,
        typeArgs: typeRef.def.generics.map(g => genericToVirtual(g, ctx))
    })
    return resolveType(fieldType, [conGenericMap], ctx)
}

const checkMethodCallExpr = (
    lOperand: Operand,
    rOperand: Operand,
    call: CallOp,
    ctx: Context
): VirtualType | undefined => {
    checkOperand(lOperand, ctx)
    call.args.forEach(a => checkExpr(a.expr, ctx))

    const namedArgs = call.args.filter(a => a.name)
    namedArgs.forEach(arg => {
        addError(ctx, semanticError(ctx, arg.name!, `unexpected named argument`))
        return
    })

    const identifier = identifierFromOperand(rOperand)
    if (!identifier || identifier.names.length > 1) {
        addError(ctx, semanticError(ctx, rOperand, `expected method name, got \`${rOperand.kind}\``))
        return
    }
    const methodName = identifier.names.at(-1)!.value
    const instScope = instanceScope(ctx)
    if (instScope) {
        const instanceMap = instScope ? instanceGenericMap(instScope, ctx) : new Map()
        lOperand.type = resolveType(lOperand.type!, [instanceMap], ctx)
    }
    if (lOperand.type!.kind !== 'vid-type') {
        const msg = `expected instance type, got \`${virtualTypeToString(lOperand.type ?? unknownType)}\``
        addError(ctx, semanticError(ctx, identifier, msg))
        return
    }
    const methodVid = { names: [...lOperand.type!.identifier.names, methodName] }
    const ref = resolveVid(methodVid, ctx, ['method-def'])
    if (!ref || ref.def.kind !== 'method-def') {
        // hint if it is a field call
        ctx.silent = true
        const fieldType = checkFieldAccessExpr(lOperand, identifier, ctx)
        ctx.silent = false
        if (fieldType) {
            const msg = `method \`${methodName}\` not found\n    to access field \`${methodName}\`, surround operand in parentheses`
            addError(ctx, semanticError(ctx, identifier, msg))
        } else {
            addError(ctx, notFoundError(ctx, identifier, methodName, 'method'))
        }
        return
    }
    call.methodDef = ref.def
    const genericMaps = makeMethodGenericMaps(lOperand, identifier, ref.def, call, ctx)
    // normal method call
    const fnType = <VirtualFnType>ref.def.fn.type

    // TODO: custom check for static methods
    if (fnType.paramTypes.length !== call.args.length + 1) {
        const msg = `expected ${fnType.paramTypes.length} arguments, got ${call.args.length}`
        addError(ctx, semanticError(ctx, call, msg))
        return
    }

    // TODO: check required type args (that cannot be inferred via `resolveFnGenerics`)
    identifier.typeArgs.forEach(typeArg => checkType(typeArg, ctx))

    const paramTypes = fnType.paramTypes.map(pt => resolveType(pt, genericMaps, ctx))
    checkCallArgs(call, [lOperand, ...call.args.map(a => a.expr)], paramTypes, ctx)

    call.generics = fnType.generics.map(g => {
        const impls = resolveGenericImpls(g, ctx)
        ctx.moduleStack.at(-1)!.relImports.push(...impls)
        return {
            generic: g,
            impls
        }
    })

    // TODO: impl resolution
    if (ref.def.rel.instanceDef.kind === 'trait-def') {
        call.impl = resolveMethodImpl(lOperand.type!, ref.def, ctx)
        if (call.impl) {
            ctx.moduleStack.at(-1)!.relImports.push(call.impl)
        }
    }

    return resolveType(fnType.returnType, genericMaps, ctx)
}

const makeMethodGenericMaps = (
    lOperand: Operand,
    rOperand: Identifier,
    methodDef: MethodDef,
    call: CallOp,
    ctx: Context
): Map<string, VirtualType>[] => {
    const implForType = getInstanceForType(methodDef.rel.instanceDef, ctx)
    const implGenericMap = makeGenericMapOverStructure(lOperand.type!, implForType)
    // if Self type param is explicit, `resolveGenericsOverStructure` treats it as regular generic and interrupts
    // further mapping in `fnGenericMap`, thus should be removed
    implGenericMap.delete(selfType.name)

    const fnType = <VirtualFnType>methodDef.fn.type
    const typeArgs = rOperand.typeArgs.map(tp => typeToVirtual(tp, ctx))
    const fnTypeArgGenericMap = makeFnTypeArgGenericMap(fnType, typeArgs)
    const fnGenericMap = makeFnGenericMap(fnType, [lOperand.type!, ...call.args.map(a => a.expr.type!)])

    return [implGenericMap, fnTypeArgGenericMap, fnGenericMap]
}
