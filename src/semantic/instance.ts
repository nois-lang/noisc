import { checkCallArgs } from '.'
import { UnaryExpr } from '../ast/expr'
import { CallOp, MethodCallOp } from '../ast/op'
import { Name, Operand } from '../ast/operand'
import { Type } from '../ast/type'
import { Context, addError } from '../scope'
import { getInstanceForType, resolveMethodImpl, resolveTypeImpl } from '../scope/trait'
import { vidFromScope, vidFromString, vidToString } from '../scope/util'
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

    const methodVid = { names: [...typeVid.names, mCall.name.value] }
    const args = [expr.operand, ...mCall.call.args.map(a => a.expr)]
    return checkMethodCall_(args, mCall.call, methodVid, ctx, mCall.typeArgs)
}

export const checkMethodCall_ = (
    args: Operand[],
    call: CallOp,
    methodVid: VirtualIdentifier,
    ctx: Context,
    typeArgs?: Type[]
): VirtualType | undefined => {
    const typeVid = vidFromScope(methodVid)
    const ref = resolveVid(methodVid, ctx, ['method-def'])
    if (!ref || ref.def.kind !== 'method-def') {
        addError(ctx, notFoundError(ctx, call, vidToString(methodVid), 'method'))
        return
    }

    call.methodDef = ref.def
    const fnType = <VirtualFnType>ref.def.fn.type

    const operandTypeRef = resolveVid(typeVid, ctx, typeKinds)
    if (ref.def.rel.instanceDef.kind === 'trait-def' && !ref.def.fn.static && args.length > 0) {
        const self = args[0]
        const resolved = resolveMethodImpl(self.type!, ref.def, ctx)
        if (resolved) {
            call.impl = resolved

            ctx.moduleStack.at(-1)!.relImports.push(call.impl)
            // TODO: upcast only happen to the direct implType, but not its supertypes
            // Use case: std::range has to return Iter<T> instead of RangeIter. When RangeIter is passed into a method
            // where MapIter is expected, upcast of RangeIter for MapIter does not upcast it to Iter
            upcast(self, self.type!, ref.def.rel.implType, ctx)
        } else {
            if (operandTypeRef && operandTypeRef.def.kind !== 'trait-def' && operandTypeRef.def.kind !== 'generic') {
                addError(ctx, noImplFoundError(ctx, call, ref.def, self))
            }
        }
    } else {
        call.impl = ref.def.rel
        ctx.moduleStack.at(-1)!.relImports.push(call.impl)
    }

    let genericMaps = makeMethodGenericMaps(
        args.map(a => a.type!),
        ref.def,
        call,
        ctx,
        typeArgs
    )
    args.forEach(a => {
        a.type = resolveType(a.type!, genericMaps, ctx)
    })
    const paramTypes = fnType.paramTypes.map(pt => resolveType(pt, genericMaps, ctx))
    checkCallArgs(call, args, paramTypes, ctx)
    // recalculate generic maps since malleable args might've been updated
    genericMaps = makeMethodGenericMaps(
        args.map(a => a.type!),
        ref.def,
        call,
        ctx,
        typeArgs
    )

    const implForType = getInstanceForType(ref.def.rel.instanceDef, ctx)
    const implForGenericMap = selfType ? makeGenericMapOverStructure(selfType, implForType) : new Map()
    call.generics = fnType.generics.map((g, i) => {
        const typeArg = typeArgs?.at(i)
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

export const makeMethodGenericMaps = (
    argTypes: VirtualType[],
    methodDef: MethodDef,
    call: CallOp,
    ctx: Context,
    typeArgs?: Type[]
): Map<string, VirtualType>[] => {
    const maps = []
    const self = !methodDef.fn.static ? argTypes[0] : undefined

    if (call.impl && self) {
        const operandRel = resolveTypeImpl(self, call.impl.forType, ctx)
        if (operandRel) {
            const operandImplGenericMap = makeGenericMapOverStructure(operandRel.impl.implType, call.impl.forType)
            maps.push(operandImplGenericMap)
        }
    }

    const fnType = <VirtualFnType>methodDef.fn.type
    if (typeArgs) {
        const fnTypeArgGenericMap = makeFnTypeArgGenericMap(
            fnType,
            typeArgs.map(tp => typeToVirtual(tp, ctx))
        )
        maps.push(fnTypeArgGenericMap)
    }

    if (self) {
        const implForType = getInstanceForType(methodDef.rel.instanceDef, ctx)
        const implForGenericMap = makeGenericMapOverStructure(self, implForType)
        // if Self type param is explicit, `resolveGenericsOverStructure` treats it as regular generic and interrupts
        // further mapping in `fnGenericMap`, thus should be removed
        implForGenericMap.delete(selfType.name)
        maps.push(implForGenericMap)
    }

    const fnGenericMap = makeFnGenericMap(fnType, argTypes)
    maps.push(fnGenericMap)

    return maps
}
