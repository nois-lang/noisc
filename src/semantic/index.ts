import { checkImpl } from '../phase/impl'
import { registerImpl } from '../phase/impl-register'
import { resolveImports, setExports } from '../phase/import-resolve'
import { resolveModuleScope } from '../phase/module-resolve'
import { resolveName } from '../phase/name-resolve'
import { setSelfBound } from '../phase/self-bound'
import { setStdTypeIds } from '../phase/std-type'
import { desugar1 } from '../phase/sugar'
import { setTopScopeDefType, setTopScopeType } from '../phase/top-scope-type'
import { collectTypeBounds } from '../phase/type-bound'
import { unifyTypeBounds } from '../phase/type-unify'
import { Context, eachModule } from '../scope'

export const semanticCheck = (ctx: Context): void => {
    const phases = [
        resolveModuleScope,
        setExports,
        resolveImports,
        setStdTypeIds,
        registerImpl,
        desugar1,
        resolveName,
        setSelfBound,
        setTopScopeDefType,
        setTopScopeType,
        checkImpl,
        collectTypeBounds,
        unifyTypeBounds
    ]
    phases.forEach(f => eachModule(f, ctx))
    // ;[collectTypeBounds, unifyTypeBounds].forEach(f =>
    //     ctx.packages.at(-1)!.modules.forEach(m => {
    //         ctx.moduleStack.push(m)
    //         f(m, ctx)
    //         ctx.moduleStack.pop()
    //     })
    // )
}
