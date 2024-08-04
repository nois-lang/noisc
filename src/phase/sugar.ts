import { AstNode } from '../ast'
import { Context, idFromString } from '../scope'

/**
 * Desugar phase that runs before name resolution
 * Does:
 *     - populates type of the `self` param
 *     - sets fnDef.instance
 */
export const desugar1 = (node: AstNode, ctx: Context, parent?: AstNode) => {
    switch (node.kind) {
        case 'module': {
            node.block.statements.forEach(s => desugar1(s, ctx))
            break
        }
        case 'trait-def':
        case 'impl-def': {
            node.block.statements.forEach(s => desugar1(s, ctx, node))
            break
        }
        case 'fn-def': {
            if (parent && (parent.kind === 'impl-def' || parent.kind === 'trait-def')) {
                node.instance = parent
                node.params.forEach((p, i) => {
                    if (!p.paramType && i === 0) {
                        const selfType = idFromString('Self')
                        selfType.parseNode = p.parseNode
                        p.paramType = selfType
                    }
                })
            }
            break
        }
    }
}
