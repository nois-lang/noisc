import { UseExpr } from '../ast/statement'
import { Context } from '../scope'
import { resolveVid, statementVid, VirtualIdentifier } from '../scope/vid'
import { semanticError } from './error'

export const useExprToVids = (useExpr: UseExpr, ctx: Context): VirtualIdentifier[] => {
    if (Array.isArray(useExpr.expr)) {
        return useExpr.expr.flatMap(expr => {
            const scope = [...useExpr.scope, ...expr.scope]
            return useExprToVids({ ...useExpr, scope, expr: expr.expr }, ctx)
        })
    }
    if (useExpr.expr.kind === 'wildcard') {
        const match = resolveVid(useExprToVid(useExpr), ctx)
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
        return vids.map(vid => ({ names: [...useExpr.scope.map(s => s.value), vid.names.at(-1)!] }))
    }
    return [useExprToVid(useExpr)]
}

const useExprToVid = (useExpr: UseExpr): VirtualIdentifier => {
    if (Array.isArray(useExpr.expr)) {
        throw Error(`non-terminal use-expr`)
    }
    if (useExpr.expr.kind === 'wildcard') {
        const last = useExpr.scope.at(-1)!
        return { names: [...useExpr.scope.slice(0, -1).map(n => n.value), last.value] }
    }
    return { names: [...useExpr.scope.map(n => n.value), useExpr.expr.value] }
}
