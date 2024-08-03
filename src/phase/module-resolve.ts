import { AstNode } from '../ast'
import { Context, Definition, addError, defKey } from '../scope'
import { duplicateDefError } from '../semantic/error'
import { todo } from '../util/todo'

/**
 * Resolve module definitions available from the outside
 */
export const resolveModuleScope = (node: AstNode, ctx: Context): void => {
    switch (node.kind) {
        case 'module': {
            for (const statement of node.block.statements) {
                resolveModuleScope(statement, ctx)
            }
            break
        }
        case 'fn-def':
        case 'trait-def':
        case 'type-def': {
            addDef(node, ctx)
            break
        }
        case 'impl-def': {
            // TODO
            break
        }
        case 'var-def': {
            if (node.pub && node.pattern.expr.kind === 'name') {
                addDef(node.pattern.expr, ctx)
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
                variant.typeDef = node
            }
        }
    }
}

const addDef = (node: Definition, ctx: Context): void => {
    const m = ctx.moduleStack.at(-1)!
    const key = defKey(node)
    if (m.topScope.has(key)) {
        addError(ctx, duplicateDefError(ctx, node))
        return
    }
    if (!('pub' in node) || node.pub) {
        m.topScope.set(key, node)
    }
}
