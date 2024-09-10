import { FnDef, TraitDef } from '../ast/statement'
import { Context } from '../scope'
import { InferredType } from '../typecheck'
import { dedup } from '../util/array'
import { assert, todo, unreachable } from '../util/todo'

/**
 * TODO(perf): track implemented traits for a type in typeDef.impldTraits, populate it in a separate phase
 */
export const findMethodDefForMethodCall = (type: InferredType, ctx: Context): FnDef | undefined => {
    if (type.kind !== 'method-call') {
        assert(false, type.kind)
        return unreachable()
    }
    if (type.operandType.kind === 'def') {
        const def = type.operandType.def
        const impls = ctx.packages.flatMap(p =>
            p.modules.flatMap(m => m.impls).filter(impl => impl.forTrait && impl.forTrait.def === def)
        )
        const impldTraits = dedup(
            impls
                .map(impl => impl.identifier)
                .filter(i => i.def && i.def.kind === 'trait-def')
                .map(i => <TraitDef>i.def)
        )
        const matchingFns = impldTraits.flatMap(t =>
            t.block.statements
                .filter(s => s.kind === 'fn-def' && s.name.value === type.op.name.value)
                .map(s => <FnDef>s)
        )
        if (matchingFns.length === 1) {
            return matchingFns[0]
        } else {
            // TODO: error
            return undefined
        }
    }
    if (type.operandType.kind === 'type-param') {
        // TODO
        return undefined
    }
    return todo(type.operandType.kind)
}
