import { AstNode } from '../ast'
import { Name } from '../ast/operand'
import { FnDef, TraitDef } from '../ast/statement'
import { TypeDef } from '../ast/type-def'
import { Context, addError, defKey } from '../scope'
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

const addDef = (node: FnDef | TraitDef | TypeDef | Name, ctx: Context): void => {
    const m = ctx.moduleStack.at(-1)!
    const key = defKey(node)
    if (m.topScope.has(key)) {
        addError(ctx, duplicateDefError(ctx, node))
        return
    }
    if (node.kind === 'name' || node.pub) {
        m.topScope.set(key, node)
    }
}
