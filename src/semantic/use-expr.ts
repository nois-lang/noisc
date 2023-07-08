import { UseExpr } from '../ast/statement'
import { resolveVidMatched, statementVid, VirtualIdentifier } from '../scope/vid'
import { Context, semanticError } from '../scope'

export const flattenUseExpr = (useExpr: UseExpr, ctx: Context): VirtualIdentifier[] => {
    if (Array.isArray(useExpr.expr)) {
        return useExpr.expr.flatMap(expr => {
            const scope = [...useExpr.scope, ...expr.scope]
            return flattenUseExpr({ ...useExpr, scope, expr: expr.expr }, ctx)
        })
    }
    if (useExpr.expr.kind === 'wildcard') {
        const match = resolveVidMatched(useExprToVid(useExpr), ctx)
        if (!match) {
            ctx.errors.push(semanticError(ctx, useExpr, 'unresolved use expression'))
            return []
        }
        if (match?.def.kind !== 'module') {
            ctx.errors.push(semanticError(ctx, useExpr, 'wildcard use statement does not reference module'))
            return []
        }
        const vids = match.def.block.statements.flatMap(s => {
            const vid = statementVid(s)
            return vid ? [vid] : []
        })
        return vids.map(vid => ({ scope: useExpr.scope.map(s => s.value), name: vid.name }))
    }
    return [useExprToVid(useExpr)]
}

export const useExprToVid = (useExpr: UseExpr): VirtualIdentifier => {
    if (Array.isArray(useExpr.expr)) {
        throw Error(`non-terminal use-expr`)
    }
    if (useExpr.expr.kind === 'wildcard') {
        const last = useExpr.scope.at(-1)!
        return { scope: useExpr.scope.slice(0, -1).map(n => n.value), name: last.value }
    }
    return { scope: useExpr.scope.map(n => n.value), name: useExpr.expr.value }
}
