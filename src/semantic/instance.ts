import { checkCallArgs, checkType } from '.'
import { UnaryExpr } from '../ast/expr'
import { MethodCallOp } from '../ast/op'
import { Name, Operand } from '../ast/operand'
import { Context, addError } from '../scope'
import { getInstanceForType, resolveMethodImpl, resolveTypeImpl } from '../scope/trait'
import { vidFromString, vidToString } from '../scope/util'
import { MethodDef, VirtualIdentifier, resolveVid, typeKinds } from '../scope/vid'
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
    noImplFoundError,
    notFoundError,
    privateAccessError,
    unexpectedNamedArgError,
    unexpectedTypeError
} from './error'
import { checkExpr, checkOperand } from './expr'
import { upcast } from './upcast'

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
    const fnType = <VirtualFnType>ref.def.fn.type

    // TODO: check required type args (that cannot be inferred via `resolveFnGenerics`)
    mCall.typeArgs.forEach(typeArg => checkType(typeArg, ctx))

    const operandTypeRef = resolveVid(typeVid, ctx, typeKinds)
    if (ref.def.rel.instanceDef.kind === 'trait-def') {
        const resolved = resolveMethodImpl(operand.type!, ref.def, ctx)
        if (resolved) {
            mCall.call.impl = resolved
        } else {
            if (operandTypeRef && operandTypeRef.def.kind !== 'trait-def' && operandTypeRef.def.kind !== 'generic') {
                addError(ctx, noImplFoundError(ctx, mCall.name, ref.def, operand))
            }
        }
    } else {
        mCall.call.impl = ref.def.rel
    }
    if (mCall.call.impl) {
        ctx.moduleStack.at(-1)!.relImports.push(mCall.call.impl)
        // TODO: upcast only happen to the direct implType, but not its supertypes
        // Use case: std::range has to return Iter<T> instead of RangeIter. When RangeIter is passed into a method
        // where MapIter is expected, upcast of RangeIter for MapIter does not upcast it to Iter
        upcast(operand, operand.type!, ref.def.rel.implType, ctx)
    }

    let genericMaps = makeMethodGenericMaps(operand, ref.def, mCall, ctx)
    const args = ref.def.fn.static ? mCall.call.args.map(a => a.expr) : [operand, ...mCall.call.args.map(a => a.expr)]
    args.forEach(a => {
        a.type = resolveType(a.type!, genericMaps, ctx)
    })
    const paramTypes = fnType.paramTypes.map(pt => resolveType(pt, genericMaps, ctx))
    checkCallArgs(mCall, args, paramTypes, ctx)
    // recalculate generic maps since malleable args might've been updated
    genericMaps = makeMethodGenericMaps(operand, ref.def, mCall, ctx)

    const implForType = getInstanceForType(ref.def.rel.instanceDef, ctx)
    const implForGenericMap = makeGenericMapOverStructure(operand.type!, implForType)
    mCall.call.generics = fnType.generics.map((g, i) => {
        const typeArg = mCall.typeArgs.at(i)
        if (!typeArg) return { generic: g, impls: [] }
        const vTypeArg = typeToVirtual(typeArg, ctx)
        const t = resolveType(g, [implForGenericMap], ctx)
        if (t.kind !== 'generic') return { generic: g, impls: [] }
        const impls = g.bounds.flatMap(b => {
            const res = resolveTypeImpl(vTypeArg, b, ctx)
            if (res) {
                return [res.impl]
            }
            return []
        })
        ctx.moduleStack.at(-1)!.relImports.push(...impls)
        return { generic: g, impls }
    })

    return resolveType(fnType.returnType, genericMaps, ctx)
}

// TODO: disambiguate clashing generic names
export const makeMethodGenericMaps = (
    lOperand: Operand,
    methodDef: MethodDef,
    call: MethodCallOp,
    ctx: Context
): Map<string, VirtualType>[] => {
    const maps = []

    if (call.call.impl) {
        const operandRel = resolveTypeImpl(lOperand.type!, call.call.impl.forType, ctx)
        if (operandRel) {
            const operandImplGenericMap = makeGenericMapOverStructure(operandRel.impl.implType, call.call.impl.forType)
            maps.push(operandImplGenericMap)
        }
    }

    const fnType = <VirtualFnType>methodDef.fn.type
    const typeArgs = call.typeArgs.map(tp => typeToVirtual(tp, ctx))
    const fnTypeArgGenericMap = makeFnTypeArgGenericMap(fnType, typeArgs)
    maps.push(fnTypeArgGenericMap)

    const implForType = getInstanceForType(methodDef.rel.instanceDef, ctx)
    const implForGenericMap = makeGenericMapOverStructure(lOperand.type!, implForType)
    // if Self type param is explicit, `resolveGenericsOverStructure` treats it as regular generic and interrupts
    // further mapping in `fnGenericMap`, thus should be removed
    implForGenericMap.delete(selfType.name)
    maps.push(implForGenericMap)

    const args = [lOperand.type!, ...call.call.args.map(a => a.expr.type!)]
    const fnGenericMap = makeFnGenericMap(fnType, args)
    maps.push(fnGenericMap)

    return maps
}
