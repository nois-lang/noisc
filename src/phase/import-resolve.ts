import { Module } from '../ast'
import { Identifier } from '../ast/operand'
import { FnDef } from '../ast/statement'
import { Context, Definition, addError, defKey } from '../scope'
import { notFoundError } from '../semantic/error'
import { flatUseExprs } from '../semantic/use-expr'
import { idEq, idFromString, idToString } from '../typecheck'

/**
 * Check use exprs and populate module.useScope
 */
export const resolveImport = (module: Module, ctx: Context): void => {
    module.references = module.useExprs.filter(e => !e.pub).flatMap(e => flatUseExprs(e))
    module.reExports = module.useExprs.filter(e => e.pub).flatMap(e => flatUseExprs(e))
    ;[...module.references, ...module.reExports].forEach(useExpr => {
        const node = resolvePubId(useExpr, ctx)
        if (node) {
            addDef(node, module, ctx)
        } else {
            addError(ctx, notFoundError(ctx, useExpr, idToString(useExpr)))
        }
    })
}

const addDef = (node: Definition, module: Module, ctx: Context): void => {
    const key = defKey(node)
    if (module.useScope.has(key)) {
        // TODO: duplicate import
        return
    }
    module.useScope.set(key, node)
}

const resolvePubId = (id: Identifier, ctx: Context): Definition | undefined => {
    if (id.names.length < 2) return undefined

    const pkgName = id.names[0].value
    const pkg = ctx.packages.find(p => p.name === pkgName)
    if (!pkg) return undefined

    // base case, e.g. std::option::Option
    let nodeName = id.names.at(-1)!.value
    let modVid = idFromString(id.names.slice(1, -1).join('::'))
    let mod = pkg.modules.find(m => idEq(m.identifier, modVid))
    if (mod) {
        const node = mod.topScope.get(nodeName)
        if (node) return node
    }

    // case of Variant | FnDef, e.g. std::option::Option::Some
    if (id.names.length < 3) return undefined
    nodeName = id.names.at(-2)!.value
    modVid = idFromString(id.names.slice(1, -2).join('::'))
    mod = pkg.modules.find(m => idEq(m.identifier, modVid))
    if (mod) {
        const node = mod.topScope.get(nodeName)
        if (node) {
            switch (node.kind) {
                case 'type-def': {
                    const vName = id.names.at(-1)!
                    const v = node.variants.find(v => v.name.value === vName.value)
                    if (v) return v
                    break
                }
                case 'trait-def':
                case 'impl-def': {
                    const mName = id.names.at(-1)!
                    // TODO: report private matches as private, not just "not found"
                    const m = <FnDef | undefined>(
                        node.block.statements.find(s => s.kind === 'fn-def' && s.pub && s.name.value === mName.value)
                    )
                    if (m) return m
                    break
                }
            }
        }
    }

    return undefined
}
