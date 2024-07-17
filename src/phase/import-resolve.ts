import { Module } from '../ast'
import { Context } from '../scope'
import { useExprToVids } from '../semantic/use-expr'
import { todo } from '../util/todo'

/**
 * Check use exprs and populate module.useScope
 */
export const resolveImport = (module: Module, ctx: Context): void => {
    module.references = module.useExprs.filter(e => !e.pub).flatMap(e => useExprToVids(e))
    module.reExports = module.useExprs.filter(e => e.pub).flatMap(e => useExprToVids(e))
    todo()
}
