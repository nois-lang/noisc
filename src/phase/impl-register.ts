import { AstNode } from '../ast'
import { Context } from '../scope'

export const registerImpl = (node: AstNode, ctx: Context): void => {
    switch (node.kind) {
        case 'module':
            node.block.statements.forEach(s => registerImpl(s, ctx))
            break
        case 'impl-def':
            if (!node.for) return
            const m = ctx.moduleStack.at(-1)!
            m.impls.push(node)
            break
    }
}
