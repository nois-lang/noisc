import { BinaryExpr } from '../ast/expr'
import { Context } from '../scope'
import { semanticError } from './error'
import { checkCallArgs, checkOperand } from './index'
import { Operand } from '../ast/operand'
import { CallOp } from '../ast/op'
import { findTypeTraits } from '../scope/trait'
import { VirtualFnType, VirtualType, virtualTypeToString } from '../typecheck'
import { resolveVid, vidToString } from '../scope/vid'
import { FnDef, TraitDef } from '../ast/statement'

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
    if (lOperand.type?.kind !== 'type-def' && lOperand.type?.kind !== 'variant-type') {
        return
    }
    if (rOperand.kind !== 'identifier' || rOperand.scope.length !== 0) {
        ctx.errors.push(semanticError(ctx, rOperand, `expected method name, got \`${rOperand.kind}\``))
        return undefined
    }
    const methodName = rOperand.name.value
    const ref = resolveVid(lOperand.type.identifier, ctx)
    const traitRefs = ref?.def.kind === 'trait-def'
        ? [ref]
        : findTypeTraits(lOperand.type.identifier, ctx).filter(ref =>
            ref.def.block.statements
                .some(s => s.kind === 'fn-def' && s.name.value === methodName)
        )
    if (traitRefs.length === 0) {
        ctx.errors.push(semanticError(ctx, rOperand, `method ${virtualTypeToString(lOperand.type!)}::${methodName} not found`))
        return undefined
    }
    if (traitRefs.length > 1) {
        const traits = traitRefs.map(f => vidToString(f.qualifiedVid)).join(', ')
        ctx.errors.push(semanticError(
            ctx,
            rOperand,
            `clashing method name ${virtualTypeToString(lOperand.type!)}::${methodName}: ${traits}`)
        )
        return undefined
    }
    const kind = <TraitDef>traitRefs[0].def
    const fn = <FnDef>kind.block.statements.find(s => s.kind === 'fn-def' && s.name.value === methodName)!

    callOp.args.forEach(a => checkOperand(a, ctx))

    checkCallArgs(callOp, [lOperand, ...callOp.args], (<VirtualFnType>fn.type).paramTypes, ctx)

    return (<VirtualFnType>fn.type).returnType
}
