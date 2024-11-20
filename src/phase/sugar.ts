import { AstNode } from '../ast'
import { Context, idFromString } from '../scope'
import { todo } from '../util/todo'

/**
 * Desugar phase that runs before name resolution
 * Does:
 *     - populates type of the `self` param
 *     - sets fnDef.instance
 *     - set fnDef.returnType to Unit if not specified
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
                    if (i === 0 && !p.paramType && p.pattern.expr.kind === 'name' && p.pattern.expr.value === 'self') {
                        const selfType = idFromString('Self')
                        selfType.parseNode = p.parseNode
                        p.paramType = selfType
                    }
                })
            }
            node.returnType ??= ctx.stdTypeIds.unit ?? { kind: 'hole' }
            break
        }
        case 'compose-op': {
            todo()
            break
        }
    }
}
