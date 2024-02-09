import { UseExpr } from '../ast/statement'
import { VirtualIdentifier } from '../scope/vid'

export interface VirtualUseExpr {
    vid: VirtualIdentifier
    useExpr: UseExpr
}

export const useExprToVids = (useExpr: UseExpr): VirtualUseExpr[] => {
    if (Array.isArray(useExpr.expr)) {
        return useExpr.expr.flatMap(expr => {
            const scope = [...useExpr.scope, ...expr.scope]
            return useExprToVids({ ...useExpr, scope, expr: expr.expr })
        })
    } else if (useExpr.expr.value === 'self') {
        const vid: VirtualIdentifier = { names: useExpr.scope.map(n => n.value) }
        return [{ vid, useExpr }]
    } else {
        const vid: VirtualIdentifier = { names: [...useExpr.scope.map(n => n.value), useExpr.expr.value] }
        return [{ vid, useExpr }]
    }
}
