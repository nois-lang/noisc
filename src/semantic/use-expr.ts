import { UseExpr } from '../ast/statement'

export const flattenUseExpr = (useExpr: UseExpr): UseExpr[] => {
    if (Array.isArray(useExpr.expr)) {
        return useExpr.expr.map(expr => {
            const scope = [...useExpr.scope, ...expr.scope]
            return { ...useExpr, scope, expr: expr.expr }
        })
    }
    return [useExpr]
}
