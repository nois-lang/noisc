import { checkCallArgs, checkOperand } from '.'
import { BinaryExpr } from '../ast/expr'
import { CallOp } from '../ast/op'
import { Operand } from '../ast/operand'
import { FnDef, TraitDef } from '../ast/statement'
import { Context } from '../scope'
import { findTypeTraits, getImplTargetType } from '../scope/trait'
import { vidToString } from '../scope/util'
import { VirtualIdentifierMatch, resolveVid } from '../scope/vid'
import { VirtualFnType, VirtualType, typeToVirtual, virtualTypeToString } from '../typecheck'
import { resolveFnGenerics, resolveGenericsOverStructure, resolveType } from '../typecheck/generic'
import { notFoundError, semanticError } from './error'

export const checkAccessExpr = (binaryExpr: BinaryExpr, ctx: Context): void => {
    const rOp = binaryExpr.rOperand
    if (rOp.kind === 'identifier') {
        checkFieldAccessExpr(binaryExpr, ctx)
        return
    }
    if (rOp.kind === 'unary-expr' && rOp.unaryOp.kind === 'call-op') {
        binaryExpr.type = checkMethodCallExpr(binaryExpr.lOperand, rOp.operand, rOp.unaryOp, ctx)
        return
    }
    if (rOp.kind === 'unary-expr' && rOp.unaryOp.kind === 'con-op') {
        // TODO
        return
    }

    ctx.errors.push(semanticError(ctx, rOp, `expected field access or method call, got ${rOp.kind}`))
}

const checkFieldAccessExpr = (binaryExpr: BinaryExpr, ctx: Context): void => {
    // TODO
}

const checkMethodCallExpr = (lOperand: Operand, rOperand: Operand, callOp: CallOp, ctx: Context): VirtualType | undefined => {
    checkOperand(lOperand, ctx)
    if (lOperand.type?.kind !== 'vid-type') {
        return
    }
    if (rOperand.kind !== 'identifier' || rOperand.scope.length !== 0) {
        ctx.errors.push(semanticError(ctx, rOperand, `expected method name, got \`${rOperand.kind}\``))
        return undefined
    }
    const methodName = rOperand.name.value
    const traitFnVid = { names: [...lOperand.type.identifier.names, methodName] }
    const ref = resolveVid(traitFnVid, ctx, ['method-def'])
    if (!ref || ref.def.kind !== 'method-def') {
        ctx.errors.push(notFoundError(ctx, rOperand, vidToString(traitFnVid)))
        return
    }

    callOp.args.forEach(a => checkOperand(a, ctx))

    const fnType = <VirtualFnType>ref.def.fn.type

    // TODO: custom check for static methods
    if (fnType.paramTypes.length !== callOp.args.length + 1) {
        ctx.errors.push(semanticError(ctx, callOp, `expected ${fnType.paramTypes.length} arguments, got ${callOp.args.length}`))
        return
    }

    const instanceType = lOperand.type!
    const implTargetType = getImplTargetType(ref.def.trait, ctx)
    const implGenericMap = resolveGenericsOverStructure(instanceType, implTargetType)
    const fnGenericMap = resolveFnGenerics(
        fnType,
        [lOperand.type, ...callOp.args.map(a => a.type!)],
        lOperand.kind === 'identifier' && lOperand.typeArgs.length > 0
            ? lOperand.typeArgs.map(tp => typeToVirtual(tp, ctx))
            : undefined,
    )
    const genericMaps = [implGenericMap, fnGenericMap]
    const paramTypes = fnType.paramTypes.map((pt, i) => resolveType(
        pt,
        genericMaps,
        callOp.args.at(i) ?? callOp,
        ctx
    ))
    checkCallArgs(callOp, [lOperand, ...callOp.args], paramTypes, ctx)

    return resolveType(fnType.returnType, genericMaps, rOperand, ctx)
}
