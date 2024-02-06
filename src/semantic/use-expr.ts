import { UseExpr } from '../ast/statement'
import { VirtualIdentifier } from '../scope/vid'

export const useExprToVids = (useExpr: UseExpr): VirtualIdentifier[] => {
    if (Array.isArray(useExpr.expr)) {
        return useExpr.expr.flatMap(expr => {
            const scope = [...useExpr.scope, ...expr.scope]
            return useExprToVids({ ...useExpr, scope, expr: expr.expr })
        })
    } else if (useExpr.expr.value === 'self') {
        return [{ names: useExpr.scope.map(n => n.value) }]
    } else {
        return [{ names: [...useExpr.scope.map(n => n.value), useExpr.expr.value] }]
    }
}
