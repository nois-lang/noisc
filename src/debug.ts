import { AstNode } from './ast'
import { inferredTypeToString } from './scope'

export const debugAst = (node: AstNode): any => {
    if (typeof node !== 'object') return node
    return Object.fromEntries(
        Object.entries(node)
            .filter(([p]) => !['parseNode', 'source', 'def'].includes(p))
            .map(([p, v]) => {
                if (p === 'type') {
                    return [p, inferredTypeToString(v)]
                }
                return [p, v]
            })
            .map(([p, v]) => {
                if (Array.isArray(v)) {
                    return [p, v.map(debugAst)]
                }
                if (typeof v === 'object' && 'parseNode' in v) {
                    return [p, debugAst(v)]
                }
                return [p, v]
            })
    )
}
