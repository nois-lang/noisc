import { AstNode } from '../ast'
import { FnDef } from '../ast/statement'
import { emitParseNode } from '../codegen/declaration'
import { Context, addError, idToString } from '../scope'
import { genericError, notFoundError } from '../semantic/error'

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
                    addError(
                        ctx,
                        genericError(ctx, node.identifier, `\`${idToString(node.identifier)}\` is not a trait`)
                    )
                    return
                }
                const traitMethod = traitMethods.find(m => m.name.value === im.name.value)
                if (!traitMethod) {
                    const msg = `method \`${im.name.value}\` not found in trait \`${traitDef.name.value}\``
                    addError(ctx, genericError(ctx, im.name, msg))
                    return
                }
                // TODO: trait and impl methods must match signatures
            })
            requiredMethods.forEach(rm => {
                const implMethod = implMethods.find(m => m.name.value === rm.name.value)
                if (!implMethod) {
                    const msg = `missing implementation of method \`${idToString(
                        node.identifier
                    )}\` required by trait \`${traitDef.name.value}\``
                    const rmStr = `${emitParseNode(rm.parseNode!)} { todo() }`
                    const note = `implement method\n    ${rmStr}`
                    addError(ctx, genericError(ctx, node.identifier, msg, [note]))
                    return
                }
            })
            break
    }
}
