import { UseExpr } from '../ast/statement'
import { VirtualIdentifier } from '../scope/vid'

export const flattenUseExpr = (useExpr: UseExpr): UseExpr[] => {
    if (Array.isArray(useExpr.expr)) {
        return useExpr.expr.flatMap(expr => {
            const scope = [...useExpr.scope, ...expr.scope]
            return flattenUseExpr({ ...useExpr, scope, expr: expr.expr })
        })
    }
    return [useExpr]
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
