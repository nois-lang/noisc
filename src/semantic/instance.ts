import { checkCallArgs, checkType } from '.'
import { UnaryExpr } from '../ast/expr'
import { MethodCallOp } from '../ast/op'
import { Name, Operand } from '../ast/operand'
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
import { selfType } from '../typecheck/type'
import { assert } from '../util/todo'
import {
    narrowFieldAccessError,
    notFoundError,
    privateAccessError,
    unexpectedNamedArgError,
    unexpectedTypeError
} from './error'
import { checkExpr, checkOperand } from './expr'

export const checkFieldAccess = (operand: Operand, name: Name, ctx: Context): VirtualType | undefined => {
    checkOperand(operand, ctx)
    if (!(operand.type?.kind === 'vid-type')) {
        addError(ctx, unexpectedTypeError(ctx, name, 'variant type', operand.type!))
        return
    }
    const typeVid = operand.type.identifier
    const typeRef = resolveVid(typeVid, ctx, ['type-def'])
    if (!typeRef || typeRef.def.kind !== 'type-def') {
        addError(ctx, notFoundError(ctx, operand, vidToString(typeVid), 'type'))
        return
    }
    const typeDef = typeRef.def
    const fieldName = name.value
    // check that every type variant has such field
    const matchedCount = typeDef.variants.filter(v => v.fieldDefs.find(f => f.name.value === fieldName)).length
    if (matchedCount === 0) {
        addError(ctx, notFoundError(ctx, name, fieldName, 'field'))
        return
    } else {
        if (matchedCount !== typeDef.variants.length) {
            addError(ctx, narrowFieldAccessError(ctx, name))
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
        addError(ctx, narrowFieldAccessError(ctx, name))
        return
    }

    const sameModule = ctx.moduleStack.at(-1)! === typeRef.module
    if (!sameModule && !fieldCandidates.every(f => f.pub)) {
        addError(ctx, privateAccessError(ctx, name, 'field', vidToString(typeRef.vid)))
        return
    }

    const conGenericMap = makeGenericMapOverStructure(operand.type, {
        kind: 'vid-type',
        identifier: typeRef.vid,
        typeArgs: typeRef.def.generics.map(g => genericToVirtual(g, ctx))
    })
    return resolveType(fieldType, [conGenericMap], ctx)
}

export const checkMethodCall = (expr: UnaryExpr, mCall: MethodCallOp, ctx: Context): VirtualType | undefined => {
    if (expr.type) return expr.type

    const operand = expr.operand
    checkOperand(operand, ctx)
    mCall.call.args.forEach(arg => {
        checkExpr(arg.expr, ctx)
        if (arg.name) {
            addError(ctx, unexpectedNamedArgError(ctx, arg))
        }
    })

    let typeVid: VirtualIdentifier
    if (operand.type!.kind === 'vid-type') {
        typeVid = operand.type!.identifier
    } else if (operand.type!.kind === 'generic') {
        typeVid = vidFromString(operand.type!.name)
    } else {
        addError(ctx, unexpectedTypeError(ctx, mCall.name, 'instance type', operand.type!))
        return
    }

    const methodName = mCall.name.value
    const methodVid = { names: [...typeVid.names, methodName] }
    const ref = resolveVid(methodVid, ctx, ['method-def'])
    if (!ref || ref.def.kind !== 'method-def') {
        // hint if it is a field call
        ctx.silent = true
        const fieldType = checkFieldAccess(operand, mCall.name, ctx)
        ctx.silent = false
        if (fieldType) {
            const note = `to access field \`${methodName}\`, surround operand in parentheses`
            addError(ctx, notFoundError(ctx, mCall.name, vidToString(methodVid), 'method', [note]))
        } else {
            addError(ctx, notFoundError(ctx, mCall.name, vidToString(methodVid), 'method'))
        }
        return
    }

    mCall.call.methodDef = ref.def
    const genericMaps = makeMethodGenericMaps(operand, ref.def, mCall, ctx)
    const fnType = <VirtualFnType>ref.def.fn.type

    // TODO: check required type args (that cannot be inferred via `resolveFnGenerics`)
    mCall.typeArgs.forEach(typeArg => checkType(typeArg, ctx))

    const args = ref.def.fn.static ? mCall.call.args.map(a => a.expr) : [operand, ...mCall.call.args.map(a => a.expr)]
    const paramTypes = fnType.paramTypes.map(pt => resolveType(pt, genericMaps, ctx))
    checkCallArgs(mCall, args, paramTypes, ctx)

    if (ref.def.rel.instanceDef.kind === 'trait-def') {
        mCall.call.impl = resolveMethodImpl(operand.type!, ref.def, ctx)
    } else {
        mCall.call.impl = ref.def.rel
    }
    if (mCall.call.impl) {
        ctx.moduleStack.at(-1)!.relImports.push(mCall.call.impl)
    }

    mCall.call.generics = fnType.generics.map(g => {
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
    methodDef: MethodDef,
    call: MethodCallOp,
    ctx: Context
): Map<string, VirtualType>[] => {
    const implForType = getInstanceForType(methodDef.rel.instanceDef, ctx)
    const implGenericMap = makeGenericMapOverStructure(lOperand.type!, implForType)
    // if Self type param is explicit, `resolveGenericsOverStructure` treats it as regular generic and interrupts
    // further mapping in `fnGenericMap`, thus should be removed
    implGenericMap.delete(selfType.name)

    const fnType = <VirtualFnType>methodDef.fn.type
    const typeArgs = call.typeArgs.map(tp => typeToVirtual(tp, ctx))
    const fnTypeArgGenericMap = makeFnTypeArgGenericMap(fnType, typeArgs)
    const fnGenericMap = makeFnGenericMap(fnType, [lOperand.type!, ...call.call.args.map(a => a.expr.type!)])

    return [fnTypeArgGenericMap, implGenericMap, fnGenericMap]
}
