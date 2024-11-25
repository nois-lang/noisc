import { Module } from '../ast'
import { checkImpl } from '../phase/impl'
import { registerImpl } from '../phase/impl-register'
import { resolveImports, setExports } from '../phase/import-resolve'
import { resolveModuleScope } from '../phase/module-resolve'
import { resolveName } from '../phase/name-resolve'
import { setStdTypeIds } from '../phase/std-type'
import { desugar } from '../phase/sugar'
import { setTopScopeType } from '../phase/top-scope-type'
import { collectTypeBounds } from '../phase/type-bound'
import { unifyTypeBounds } from '../phase/type-unify'
import { Context, eachModule } from '../scope'

export const semanticCheck = (ctx: Context): void => {
    const phases: ((module: Module, ctx: Context) => void)[] = [
        (node, ctx) => desugar(node, 'init', ctx),
        resolveModuleScope,
        setExports,
        resolveImports,
        setStdTypeIds,
        registerImpl,
        (node, ctx) => desugar(node, 'pre-name-resolve', ctx),
        resolveName,
        setTopScopeType,
        checkImpl,
        collectTypeBounds,
        unifyTypeBounds
    ]
    phases.forEach(f => eachModule(f, ctx))
}
