import { EmitNode } from '../codegen/js/node'
import { Span } from '../location'
import { getSpan } from '../parser'

export const foldEmitTree = (node: EmitNode, index: number = 0): { emit: string; map: [Span, Span][] } => {
    const map: [Span, Span][] = []
    if (node.kind === 'token') {
        if (node.parseNode) {
            const span = getSpan(node.parseNode)
            const emit = node.value
            return { emit, map: [[span, { start: index, end: index + emit.length }]] }
        } else {
            return { emit: node.value, map: [] }
        }
    }
    let emit = ''
    const start = index
    for (const n of node.nodes) {
        const { emit: nEmit, map: nMap } = foldEmitTree(n, index)
        emit += nEmit
        map.push(...nMap)
        index += nEmit.length
    }
    if (node.parseNode) {
        const span = getSpan(node.parseNode)
        map.push([span, { start, end: index + 1 }])
    }
    return { emit, map }
}
