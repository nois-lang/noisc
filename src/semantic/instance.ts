import { checkCallArgs, checkType } from '.'
import { BinaryExpr } from '../ast/expr'
import { CallOp } from '../ast/op'
import { Identifier, Operand, identifierFromOperand } from '../ast/operand'
import { Context, addError } from '../scope'
import { getInstanceForType, resolveGenericImpls, resolveMethodImpl } from '../scope/trait'
import { vidFromString, vidToString } from '../scope/util'
import { MethodDef, VirtualIdentifier, resolveVid } from '../scope/vid'
import { VirtualFnType, VirtualType, combine, genericToVirtual, typeToVirtual } from '../typecheck'
import {
    makeFnGenericMap,
    makeFnTypeArgGenericMap,
    makeGenericMapOverStructure,
    resolveType
} from '../typecheck/generic'
import { selfType, unknownType } from '../typecheck/type'
import { assert, unreachable } from '../util/todo'
import {
    expectedFieldError,
    expectedMethodError,
    narrowFieldAccessError,
    notFoundError,
    privateAccessError,
    unexpectedNamedArgError,
    unexpectedTypeError
} from './error'
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
            binaryExpr.type =
                checkMethodCallExpr(binaryExpr, lOperand, rOperand.operand, rOperand.op, ctx) ?? unknownType
            return
        } else {
            checkOperand(rOperand, ctx)
            binaryExpr.type = rOperand.type
            return
        }
    }
    unreachable()
}

const checkFieldAccessExpr = (lOp: Operand, field: Identifier, ctx: Context): VirtualType | undefined => {
    checkOperand(lOp, ctx)
    // TODO: make sure no type args specified; check other identifier uses also
    if (field.names.length > 1) {
        addError(ctx, expectedFieldError(ctx, field))
        return
    }
    if (!(lOp.type?.kind === 'vid-type')) {
        addError(ctx, unexpectedTypeError(ctx, field, 'variant type', lOp.type!))
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
        addError(ctx, notFoundError(ctx, field, fieldName, 'field'))
        return
    } else {
        if (matchedCount !== typeDef.variants.length) {
            addError(ctx, narrowFieldAccessError(ctx, field))
            return
        }
    }
    // if field is defined in multiple variants, make sure their type is equal
    // normally single variant types use field access, but there is no reason to restrict multiple variants sharing the
    // same field
    const fieldCandidates = typeDef.variants
        .map(v => v.fieldDefs.find(f => f.name.value === fieldName))
        .filter(f => !!f)
        .map(f => f!)
    assert(fieldCandidates.length > 0)
    const fieldType = fieldCandidates[0].type!
    if (!fieldCandidates.every(f => !!combine(fieldType, f.type!, ctx))) {
        addError(ctx, narrowFieldAccessError(ctx, field))
        return
    }

    const sameModule = ctx.moduleStack.at(-1)! === typeRef.module
    if (!sameModule && !fieldCandidates.every(f => f.pub)) {
        addError(ctx, privateAccessError(ctx, field, 'field', vidToString(typeRef.vid)))
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
    binaryExpr: BinaryExpr,
    lOperand: Operand,
    rOperand: Operand,
    call: CallOp,
    ctx: Context
): VirtualType | undefined => {
    if (binaryExpr.type) return binaryExpr.type

    checkOperand(lOperand, ctx)
    call.args.forEach(arg => {
        checkExpr(arg.expr, ctx)
        if (arg.name) {
            addError(ctx, unexpectedNamedArgError(ctx, arg))
        }
    })

    const identifier = identifierFromOperand(rOperand)
    if (!identifier || identifier.names.length > 1) {
        addError(ctx, expectedMethodError(ctx, rOperand))
        return
    }

    let typeVid: VirtualIdentifier
    if (lOperand.type!.kind === 'vid-type') {
        typeVid = lOperand.type!.identifier
    } else if (lOperand.type!.kind === 'generic') {
        typeVid = vidFromString(lOperand.type!.name)
    } else {
        addError(ctx, unexpectedTypeError(ctx, identifier, 'instance type', lOperand.type!))
        return
    }

    const methodName = identifier.names.at(-1)!.value
    const methodVid = { names: [...typeVid.names, methodName] }
    const ref = resolveVid(methodVid, ctx, ['method-def'])
    if (!ref || ref.def.kind !== 'method-def') {
        // hint if it is a field call
        ctx.silent = true
        const fieldType = checkFieldAccessExpr(lOperand, identifier, ctx)
        ctx.silent = false
        if (fieldType) {
            const note = `to access field \`${methodName}\`, surround operand in parentheses`
            addError(ctx, notFoundError(ctx, identifier, vidToString(methodVid), 'method', [note]))
        } else {
            addError(ctx, notFoundError(ctx, identifier, vidToString(methodVid), 'method'))
        }
        return
    }

    call.methodDef = ref.def
    const genericMaps = makeMethodGenericMaps(lOperand, identifier, ref.def, call, ctx)
    const fnType = <VirtualFnType>ref.def.fn.type

    // TODO: check required type args (that cannot be inferred via `resolveFnGenerics`)
    identifier.typeArgs.forEach(typeArg => checkType(typeArg, ctx))

    const args = ref.def.fn.static ? call.args.map(a => a.expr) : [lOperand, ...call.args.map(a => a.expr)]
    const paramTypes = fnType.paramTypes.map(pt => resolveType(pt, genericMaps, ctx))
    checkCallArgs(call, args, paramTypes, ctx)

    if (ref.def.rel.instanceDef.kind === 'trait-def') {
        call.impl = resolveMethodImpl(lOperand.type!, ref.def, ctx)
    } else {
        call.impl = ref.def.rel
    }
    if (call.impl) {
        ctx.moduleStack.at(-1)!.relImports.push(call.impl)
    }

    call.generics = fnType.generics.map(g => {
        const t = resolveType(g, [genericMaps[1]], ctx)
        if (t.kind !== 'generic') return { generic: g, impls: [] }
        const impls = resolveGenericImpls(t, ctx)
        ctx.moduleStack.at(-1)!.relImports.push(...impls)
        return { generic: g, impls }
    })

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

    return [fnTypeArgGenericMap, implGenericMap, fnGenericMap]
}
