import { AstNode } from '../ast'
import { Context, addDef } from '../scope'
import { todo } from '../util/todo'

/**
 * Set {@link Module.typeScope}, {@link Module.valueScope}
 */
export const resolveModuleScope = (node: AstNode, ctx: Context): void => {
    const m = ctx.moduleStack.at(-1)!
    switch (node.kind) {
        case 'module': {
            for (const statement of node.block.statements) {
                resolveModuleScope(statement, ctx)
            }
            break
        }
        case 'type-def':
            addDef(node, m.topScope, ctx)
            break
        case 'trait-def':
            addDef(node, m.topScope, ctx)
            break
        case 'var-def': {
            if (node.pattern.expr.kind === 'name') {
                addDef(node.pattern.expr, m.topScope, ctx)
            } else if (node.pattern.expr.kind === 'hole') {
            } else {
                todo('destructuring is not allowed in module scope')
            }
            break
        }
    }
    switch (node.kind) {
        case 'type-def': {
            for (const variant of node.variants) {
                addDef(variant, m.topScope, ctx)
                variant.typeDef = node

                for (const field of variant.fields) {
                    field.variant = variant
                    if (node.variants.length === 1) {
                        addDef(field, m.topScope, ctx)
                    }
                }
            }
        }
    }
}
