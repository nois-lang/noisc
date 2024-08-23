import { AstNode } from './ast'
import { inferredTypeToString } from './typecheck'
import { ExtractKeys } from './util/type'

export const debugAst = (
    node: AstNode,
    focusKinds: ExtractKeys<AstNode>[] = ['kind', 'type'],
    reportRecursive = false,
    depth = 0
): any => {
    if (depth > 10) return reportRecursive ? '@rec' : undefined

    const o = Object.fromEntries(
        Object.entries(node)
            .filter(([p]) => !['parseNode', 'source'].includes(p))
            .map(([p, v]) => {
                if (p === 'type') {
                    if (focusKinds.includes(<any>p)) {
                        return [p, inferredTypeToString(v)]
                    } else {
                        return undefined
                    }
                }
                if (p === 'def' || p === 'typeDef') {
                    if (focusKinds.includes(<any>p)) {
                        return [p, v.kind]
                    } else {
                        return undefined
                    }
                }
                if (Array.isArray(v)) {
                    const items = v
                        .map(i => debugAst(i, focusKinds, reportRecursive, depth + 1))
                        .filter(i => i !== undefined)
                    return [p, items]
                }
                if (typeof v === 'object' && 'parseNode' in v) {
                    return [p, debugAst(v, focusKinds, reportRecursive, depth + 1)]
                }
                if (focusKinds.includes(<any>p)) {
                    return [p, v]
                }
                return undefined
            })
            .filter(t => t !== undefined)
            .map(t => t!)
            .filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0))
    )
    if (Object.keys(o).length === 0) return undefined
    return o
}
