import { AstNode } from './ast'
import { typeToString } from './typecheck'

export const debugAst = (node: AstNode): any => {
    if (typeof node !== 'object') return node
    return Object.fromEntries(
        Object.entries(node)
            .filter(([p]) => !['parseNode', 'source'].includes(p))
            .map(([p, v]) => {
                if (p === 'type') {
                    return [p, typeToString(v)]
                }
                if (p === 'def') {
                    return [p, v.kind]
                }
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
