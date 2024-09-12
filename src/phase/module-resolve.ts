import { AstNode } from '../ast'
import { Context, Definition, addError, defKey } from '../scope'
import { duplicateDefError } from '../semantic/error'
import { todo } from '../util/todo'
import { findById } from './name-resolve'

/**
 * Resolve `module.topScope`
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
            if (node.forTrait) break
            const typeDef = findById(node.identifier, ctx)
            if (typeDef?.kind !== 'type-def') break
            typeDef.impl = node
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

                for (const field of variant.fieldDefs) {
                    field.variant = variant
                }
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
    m.topScope.set(key, node)
}
