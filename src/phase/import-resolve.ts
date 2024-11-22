import { Module } from '../ast'
import { Identifier } from '../ast/operand'
import { Context, Definition, addDef, addError } from '../scope'
import { idEq, idFromString, idToString } from '../scope'
import { notFoundError } from '../semantic/error'
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
        const defs = resolvePubId(useExpr, ctx)
        if (defs.length > 0) {
            defs.forEach(def => addDef(def, module.useScope, ctx, useExpr))
        } else {
            addError(ctx, notFoundError(ctx, useExpr, idToString(useExpr)))
        }
    })
}

const resolvePubId = (id: Identifier, ctx: Context): Definition[] => {
    const defs: Definition[] = []

    const pkgName = id.names[0].value
    const pkg = ctx.packages.find(p => p.name === pkgName)
    if (!pkg) return defs

    const defName = id.names.at(-1)!.value
    const modId = idFromString(
        id.names
            .slice(0, -1)
            .map(n => n.value)
            .join('::')
    )
    let mod = pkg.modules.find(m => idEq(m.identifier, modId))
    if (mod) {
        const typeDef = mod.topScope.type.get(defName)
        if (typeDef) {
            defs.push(typeDef)
        }

        const valueDef = mod.topScope.value.get(defName)
        if (valueDef) {
            defs.push(valueDef)
        }

        // id is re exported
        const reExport = mod.reExports!.find(re => re.names.at(-1)!.value === id.names.at(-1)!.value)
        if (reExport) {
            defs.push(...resolvePubId(reExport, ctx))
        }

        return defs
    }

    // case of module import, e.g. std::float
    mod = pkg.modules.find(m => idEq(m.identifier, id))
    if (mod) {
        defs.push(mod)
        return defs
    }

    return defs
}
