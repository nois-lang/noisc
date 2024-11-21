import { MethodCallOp } from '../ast/op'
import { FnDef, TraitDef } from '../ast/statement'
import { Context } from '../scope'
import { InferredType } from '../typecheck'
import { dedup } from '../util/array'
import { todo } from '../util/todo'

/**
 * TODO(perf): track implemented traits for a type in typeDef.impldTraits, populate it in a separate phase
 */
export const findMethodDefForMethodCall = (
    operandType: InferredType,
    op: MethodCallOp,
    ctx: Context
): FnDef | undefined => {
    if (operandType.kind !== 'identifier') return todo(operandType.kind)

    const def = operandType.def
    const block = def?.kind === 'type-def' ? def?.impl?.block : def?.kind === 'trait-def' ? def?.block : undefined
    const m = <FnDef>block?.statements.find(s => s.kind === 'fn-def' && s.name.value === op.name.value)
    if (m) return m

    const impls = ctx.packages.flatMap(p =>
        p.modules.flatMap(m => m.impls).filter(impl => impl.for && impl.for.def === def)
    )
    const impldTraits = dedup(
        impls
            .map(impl => impl.trait)
            .filter(i => i.def && i.def.kind === 'trait-def')
            .map(i => <TraitDef>i.def)
    )
    const matchingFns = impldTraits.flatMap(t =>
        t.block.statements.filter(s => s.kind === 'fn-def' && s.name.value === op.name.value).map(s => <FnDef>s)
    )
    if (matchingFns.length === 1) {
        return matchingFns[0]
    } else {
        // TODO: error
        return undefined
    }
}
