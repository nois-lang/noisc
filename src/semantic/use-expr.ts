import { UseExpr } from '../ast/statement'
import { VirtualIdentifier } from '../scope/vid'

export const useExprToVids = (useExpr: UseExpr): VirtualIdentifier[] => {
    if (Array.isArray(useExpr.expr)) {
        return useExpr.expr.flatMap(expr => {
            const scope = [...useExpr.scope, ...expr.scope]
            return useExprToVids({ ...useExpr, scope, expr: expr.expr })
        })
    }
    return [useExprToVid(useExpr)]
}

const useExprToVid = (useExpr: UseExpr): VirtualIdentifier => {
    if (Array.isArray(useExpr.expr)) {
        throw Error(`non-terminal use-expr`)
    }
    if (useExpr.expr.kind === 'wildcard') {
        return { names: useExpr.scope.map(n => n.value) }
    }
    return { names: [...useExpr.scope.map(n => n.value), useExpr.expr.value] }
}
