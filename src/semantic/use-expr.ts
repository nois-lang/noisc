import { Identifier } from '../ast/operand'
import { UseExpr } from '../ast/statement'

export const flatUseExprs = (useExpr: UseExpr): Identifier[] => {
    if (Array.isArray(useExpr.expr)) {
        return useExpr.expr.flatMap(expr => {
            const scope = [...useExpr.scope, ...expr.scope]
            return flatUseExprs({ ...useExpr, scope, expr: expr.expr })
        })
    } else {
        const names = useExpr.expr.value === 'self' ? [...useExpr.scope] : [...useExpr.scope, useExpr.expr]
        return [{ kind: 'identifier', parseNode: useExpr.expr.parseNode, names, typeArgs: [] }]
    }
}
