import { checkCallArgs, checkType } from '.'
import { BinaryExpr } from '../ast/expr'
import { PosCall } from '../ast/op'
import { Identifier, Operand, identifierFromOperand } from '../ast/operand'
import { Context, addError, instanceScope } from '../scope'
import { getInstanceForType } from '../scope/trait'
import { vidToString } from '../scope/util'
import { MethodDef, resolveVid } from '../scope/vid'
import { VirtualFnType, VirtualType, genericToVirtual, typeToVirtual, virtualTypeToString } from '../typecheck'
import {
    instanceGenericMap,
    makeFnGenericMap,
    makeFnTypeArgGenericMap,
    makeGenericMapOverStructure,
    replaceGenericsWithHoles,
    resolveType
} from '../typecheck/generic'
import { selfType, unknownType } from '../typecheck/type'
import { allEqual } from '../util/array'
import { notFoundError, semanticError } from './error'
import { checkOperand, makeFnGenericMaps } from './expr'

export const checkAccessExpr = (binaryExpr: BinaryExpr, ctx: Context): void => {
    const rOp = binaryExpr.rOperand
    if (rOp.kind === 'identifier') {
        binaryExpr.type = checkFieldAccessExpr(binaryExpr.lOperand, rOp, ctx)
        return
    }
    if (rOp.kind === 'unary-expr' && rOp.postfixOp && rOp.postfixOp.kind === 'pos-call') {
        binaryExpr.type = checkMethodCallExpr(binaryExpr.lOperand, rOp.operand, rOp.postfixOp, ctx)
        return
    }
    addError(ctx, semanticError(ctx, rOp, `expected field access or method call, got ${rOp.kind}`))
}

const checkFieldAccessExpr = (lOp: Operand, field: Identifier, ctx: Context): VirtualType | undefined => {
    checkOperand(lOp, ctx)
    // TODO: make sure no type args specified; check other identifier uses also
    if (field.scope.length > 0) {
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
    const fieldName = field.name.value
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
    const typeCandidates = typeDef.variants
        .flatMap(v => v.fieldDefs.find(f => f.name.value === fieldName)?.fieldType ?? [])
        .map(t => typeToVirtual(t, ctx))
    // TODO: probably there is a better way to compare type equality
    if (!allEqual(typeCandidates.map(virtualTypeToString))) {
        const msg = `field \`${fieldName}\` is not defined in every variant of type \`${vidToString(typeRef.vid)}\``
        addError(ctx, semanticError(ctx, field, msg))
        return
    }
    const fieldType = typeCandidates[0]
    const conGenericMap = makeGenericMapOverStructure(lOp.type, {
        kind: 'vid-type',
        identifier: typeRef.vid,
        typeArgs: typeRef.def.generics.map(g => genericToVirtual(g, ctx))
    })
    return resolveType(fieldType, [conGenericMap], ctx)
}

const checkMethodCallExpr = (lOperand: Operand, rOperand: Operand, callOp: PosCall, ctx: Context): VirtualType => {
    checkOperand(lOperand, ctx)
    callOp.args.forEach(a => checkOperand(a, ctx))
    const identifier = identifierFromOperand(rOperand)
    if (!identifier || identifier.scope.length !== 0) {
        addError(ctx, semanticError(ctx, rOperand, `expected method name, got \`${rOperand.kind}\``))
        return unknownType
    }
    const methodName = identifier.name.value
    const instScope = instanceScope(ctx)
    if (instScope) {
        const instanceMap = instScope ? instanceGenericMap(instScope, ctx) : new Map()
        lOperand.type = resolveType(lOperand.type!, [instanceMap], ctx)
    }
    if (lOperand.type!.kind !== 'vid-type') {
        addError(
            ctx,
            semanticError(
                ctx,
                identifier,
                `expected instance type, got \`${virtualTypeToString(lOperand.type ?? unknownType)}\``
            )
        )
        return unknownType
    }
    const traitFnVid = { names: [...lOperand.type!.identifier.names, methodName] }
    const ref = resolveVid(traitFnVid, ctx, ['method-def'])
    if (!ref || ref.def.kind !== 'method-def') {
        // it still can be a field of fn type
        ctx.silent = true
        let fieldType = checkFieldAccessExpr(lOperand, identifier, ctx)
        ctx.silent = false
        if (!fieldType) {
            addError(ctx, notFoundError(ctx, identifier, methodName, 'method or field'))
            return unknownType
        }
        // field exists, now it's just a regular function call
        // TODO: missing type def generic map, since field is defined in type def scope
        if (fieldType.kind !== 'fn-type') {
            const message = `type error: non-callable field of type \`${virtualTypeToString(fieldType)}\``
            addError(ctx, semanticError(ctx, identifier, message))
            return unknownType
        }
        const genericMaps = makeFnGenericMaps(
            identifier.typeArgs.map(tp => typeToVirtual(tp, ctx)),
            fieldType,
            callOp.args.map(a => a.type!),
            ctx
        )
        const paramTypes = fieldType.paramTypes.map(pt => resolveType(pt, genericMaps, ctx))
        checkCallArgs(callOp, callOp.args, paramTypes, ctx)

        return replaceGenericsWithHoles(resolveType(fieldType.returnType, genericMaps, ctx))
    } else {
        const genericMaps = makeMethodGenericMaps(lOperand, identifier, ref.def, callOp, ctx)
        // normal method call
        const fnType = <VirtualFnType>ref.def.fn.type

        // TODO: custom check for static methods
        if (fnType.paramTypes.length !== callOp.args.length + 1) {
            addError(
                ctx,
                semanticError(ctx, callOp, `expected ${fnType.paramTypes.length} arguments, got ${callOp.args.length}`)
            )
            return unknownType
        }

        // TODO: check required type args (that cannot be inferred via `resolveFnGenerics`)
        identifier.typeArgs.forEach(typeArg => checkType(typeArg, ctx))

        const paramTypes = fnType.paramTypes.map(pt => resolveType(pt, genericMaps, ctx))
        checkCallArgs(callOp, [lOperand, ...callOp.args], paramTypes, ctx)

        return resolveType(fnType.returnType, genericMaps, ctx)
    }
}

const makeMethodGenericMaps = (
    lOperand: Operand,
    rOperand: Identifier,
    methodDef: MethodDef,
    callOp: PosCall,
    ctx: Context
): Map<string, VirtualType>[] => {
    const implForType = getInstanceForType(methodDef.instance, ctx)
    const implGenericMap = makeGenericMapOverStructure(lOperand.type!, implForType)
    // if Self type param is explicit, `resolveGenericsOverStructure` treats it as regular generic and interrupts
    // further mapping in `fnGenericMap`, thus should be removed
    implGenericMap.delete(selfType.name)

    const fnType = <VirtualFnType>methodDef.fn.type
    const typeArgs = rOperand.typeArgs.map(tp => typeToVirtual(tp, ctx))
    const fnTypeArgGenericMap = makeFnTypeArgGenericMap(fnType, typeArgs)
    const fnGenericMap = makeFnGenericMap(fnType, [lOperand.type!, ...callOp.args.map(a => a.type!)])

    return [implGenericMap, fnTypeArgGenericMap, fnGenericMap]
}
