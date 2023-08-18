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
import { checkCallArgs, checkOperand } from './index'

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

    // TODO: support self
    ctx.errors.push(semanticError(ctx, rOp, 'illegal operand, expected field access or method call'))
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
    const ref = resolveVid(lOperand.type.identifier, ctx)
    const traitRefs = ref?.def.kind === 'trait-def'
        ? [<VirtualIdentifierMatch<TraitDef>>ref]
        : findTypeTraits(lOperand.type.identifier, ctx)
    const traitFnRefs = traitRefs
        .flatMap(ref => {
            const fn = <FnDef | undefined>ref.def.block.statements
                .find(s => s.kind === 'fn-def' && s.name.value === methodName)
            return fn ? [{ ref, fn }] : []
        })
    if (traitFnRefs.length === 0) {
        ctx.errors.push(notFoundError(ctx, rOperand, `${virtualTypeToString(lOperand.type!)}::${methodName}`, 'method'))
        return undefined
    }
    if (traitFnRefs.length > 1) {
        const traits = traitFnRefs.map(fnRef => vidToString(fnRef.ref.qualifiedVid)).join(', ')
        ctx.errors.push(semanticError(
            ctx,
            rOperand,
            `clashing method name ${virtualTypeToString(lOperand.type!)}::${methodName}
            across traits: ${traits}`)
        )
        return undefined
    }

    callOp.args.forEach(a => checkOperand(a, ctx))

    const fn = traitFnRefs[0].fn
    const fnType = <VirtualFnType>fn.type
    const instanceType = lOperand.type!
    const implDef = traitFnRefs[0].ref.def
    const implTargetType = getImplTargetType(implDef, ctx)
    const implGenericMap = resolveGenericsOverStructure(instanceType, implTargetType)
    const fnGenericMap = resolveFnGenerics(
        fnType,
        [lOperand, ...callOp.args],
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
