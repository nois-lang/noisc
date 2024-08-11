import { Module } from '../ast'
import { Identifier } from '../ast/operand'
import { FnDef } from '../ast/statement'
import { Context, Definition, addError, defKey } from '../scope'
import { idEq, idFromString, idToString } from '../scope'
import { duplicateUseError, notFoundError } from '../semantic/error'
import { flatUseExprs } from '../semantic/use-expr'

export const setExports = (module: Module, ctx: Context): void => {
    module.references = module.useExprs.filter(e => !e.pub).flatMap(e => flatUseExprs(e))
    module.reExports = module.useExprs.filter(e => e.pub).flatMap(e => flatUseExprs(e))
}

/**
 * Check use exprs and populate module.useScope
 */
export const resolveImports = (module: Module, ctx: Context): void => {
    ;[...module.references!, ...module.reExports!].forEach(useExpr => {
        const node = resolvePubId(useExpr, ctx)
        if (node) {
            addDef(node, module, useExpr, ctx)
        } else {
            addError(ctx, notFoundError(ctx, useExpr, idToString(useExpr)))
        }
    })
}

const addDef = (node: Definition, module: Module, importId: Identifier, ctx: Context): void => {
    const key = defKey(node)
    if (module.useScope.has(key)) {
        addError(ctx, duplicateUseError(ctx, importId))
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
    let modId = idFromString(
        id.names
            .slice(0, -1)
            .map(n => n.value)
            .join('::')
    )
    let mod = pkg.modules.find(m => idEq(m.identifier, modId))
    if (mod) {
        const node = mod.topScope.get(nodeName)
        if (node) return node

        // id is re exported
        const reExport = mod.reExports!.find(re => re.names.at(-1)!.value === id.names.at(-1)!.value)
        if (reExport) {
            return resolvePubId(reExport, ctx)
        }
    }

    // case of Variant | FnDef, e.g. std::option::Option::Some
    if (id.names.length < 3) return undefined
    nodeName = id.names.at(-2)!.value
    modId = idFromString(
        id.names
            .slice(0, -2)
            .map(n => n.value)
            .join('::')
    )
    mod = pkg.modules.find(m => idEq(m.identifier, modId))
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
