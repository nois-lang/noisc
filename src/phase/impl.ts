import { AstNode } from '../ast'
import { FnDef } from '../ast/statement'
import { emitParseNode } from '../codegen/declaration'
import { Context, addError, idToString } from '../scope'
import { genericError, typeError } from '../semantic/error'
import { instantiateDefType } from '../typecheck'
import { assert } from '../util/todo'
import { findTypeErrors, unify } from './type-unify'

export const checkImpl = (node: AstNode, ctx: Context): void => {
    switch (node.kind) {
        case 'module':
            node.block.statements.forEach(s => checkImpl(s, ctx))
            break
        case 'impl-def':
            if (!node.forTrait) return
            const traitDef = node.identifier.def
            if (!traitDef) {
                // already reported
                break
            }
            if (traitDef.kind !== 'trait-def') {
                addError(ctx, genericError(ctx, node.identifier, `\`${idToString(node.identifier)}\` is not a trait`))
                break
            }
            const traitMethods = traitDef.block.statements.filter(s => s.kind === 'fn-def').map(s => <FnDef>s)
            const requiredMethods = traitMethods.filter(s => !s.block)
            const implMethods = node.block.statements.filter(s => s.kind === 'fn-def').map(s => <FnDef>s)
            implMethods.forEach(im => {
                if (im.kind !== 'fn-def') {
                    const msg = `\`${idToString(node.identifier)}\` is not a trait`
                    addError(ctx, genericError(ctx, node.identifier, msg))
                    return
                }
                if (!im.block) {
                    const msg = `method \`${im.name.value}\` is missing body`
                    addError(ctx, genericError(ctx, im, msg))
                }
                const traitMethod = traitMethods.find(m => m.name.value === im.name.value)
                if (!traitMethod) {
                    const msg = `method \`${im.name.value}\` not found in trait \`${traitDef.name.value}\``
                    addError(ctx, genericError(ctx, im.name, msg))
                    return
                }
                assert(!!im.type)
                assert(!!traitMethod.type)
                // TODO: handle unify of 'fn-type's specifically for this case (get rid of `instantiateDefType`)
                const t = unify(instantiateDefType(im.type!, ctx), instantiateDefType(traitMethod.type!, ctx), ctx)
                findTypeErrors(t).forEach(e => {
                    if (e.error.reported) return
                    // TODO: don't print method body
                    const note = `trait method is\n    ${emitParseNode(traitMethod.parseNode!)}`
                    addError(ctx, typeError(ctx, im.name, e.error, [note]))
                    e.error.reported = true
                })
            })
            requiredMethods.forEach(rm => {
                const implMethod = implMethods.find(m => m.name.value === rm.name.value)
                if (!implMethod) {
                    const msg = `missing method \`${rm.name.value}\` required by trait \`${traitDef.name.value}\``
                    const rmStr = `${emitParseNode(rm.parseNode!)} { todo() }`
                    const note = `implement method\n    ${rmStr}`
                    addError(ctx, genericError(ctx, node.identifier, msg, [note]))
                    return
                }
            })
            break
    }
}
