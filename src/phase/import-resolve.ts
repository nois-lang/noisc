import { Module } from '../ast'
import { FnDef } from '../ast/statement'
import { Context, Definition, addError, defKey } from '../scope'
import { vidEq, vidFromString, vidToString } from '../scope/util'
import { VirtualIdentifier } from '../scope/vid'
import { notFoundError } from '../semantic/error'
import { useExprToVids } from '../semantic/use-expr'

/**
 * Check use exprs and populate module.useScope
 */
export const resolveImport = (module: Module, ctx: Context): void => {
    module.references = module.useExprs.filter(e => !e.pub).flatMap(e => useExprToVids(e))
    module.reExports = module.useExprs.filter(e => e.pub).flatMap(e => useExprToVids(e))
    ;[...module.references, ...module.reExports].forEach(vue => {
        const node = resolvePubVid(vue.vid, ctx)
        if (node) {
            addDef(node, module, ctx)
        } else {
            addError(ctx, notFoundError(ctx, vue.useExpr, vidToString(vue.vid)))
        }
    })
}

const addDef = (node: Definition, module: Module, ctx: Context): void => {
    const key = defKey(node)
    if (module.useScope.has(key)) {
        // TODO: duplicate import
        return
    }
    module.topScope.set(key, node)
}

const resolvePubVid = (vid: VirtualIdentifier, ctx: Context): Definition | undefined => {
    if (vid.names.length < 2) return undefined

    const pkgName = vid.names[0]
    const pkg = ctx.packages.find(p => p.name === pkgName)
    if (!pkg) return undefined

    // base case, e.g. std::option::Option
    let nodeName = vid.names.at(-1)!
    let modVid = vidFromString(vid.names.slice(1, -1).join('::'))
    let mod = pkg.modules.find(m => vidEq(m.identifier, modVid))
    if (mod) {
        const node = mod.topScope.get(nodeName)
        if (node) return node
    }

    // case of Variant | FnDef, e.g. std::option::Option::Some
    if (vid.names.length < 3) return undefined
    nodeName = vid.names.at(-2)!
    modVid = vidFromString(vid.names.slice(1, -2).join('::'))
    mod = pkg.modules.find(m => vidEq(m.identifier, modVid))
    if (mod) {
        const node = mod.topScope.get(nodeName)
        if (node) {
            switch (node.kind) {
                case 'type-def': {
                    const vName = vid.names.at(-1)!
                    const v = node.variants.find(v => v.name.value === vName)
                    if (v) return v
                    break
                }
                case 'trait-def':
                case 'impl-def': {
                    const mName = vid.names.at(-1)!
                    // TODO: report private matches as private, not just "not found"
                    const m = <FnDef | undefined>(
                        node.block.statements.find(s => s.kind === 'fn-def' && s.pub && s.name.value === mName)
                    )
                    if (m) return m
                    break
                }
            }
        }
    }

    return undefined
}
