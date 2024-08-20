import { AstNode } from './ast'
import { inferredTypeToString } from './typecheck'

export const debugAst = (node: AstNode, depth = 0): any => {
    if (depth > 50) return '@rec'
    if (typeof node !== 'object') return node
    return Object.fromEntries(
        Object.entries(node)
            .filter(([p]) => !['parseNode', 'source'].includes(p))
            .filter(([, v]) => !(Array.isArray(v) && v.length === 0))
            .map(([p, v]) => {
                if (p === 'type') {
                    return [p, inferredTypeToString(v)]
                }
                if (p === 'def' || p === 'typeDef') {
                    return [p, v.kind]
                }
                if (Array.isArray(v)) {
                    return [p, v.map(i => debugAst(i, depth + 1))]
                }
                if (typeof v === 'object' && 'parseNode' in v) {
                    return [p, debugAst(v, depth + 1)]
                }
                return [p, v]
            })
    )
}
