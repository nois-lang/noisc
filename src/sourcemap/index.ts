import { EmitNode } from '../codegen/js/node'
import { Span, indexToLocation } from '../location'
import { getSpan } from '../parser'
import { encode } from './base64vlq'

export interface SourceMap {
    version: number
    file: string
    sourceRoot: string
    sources: string[]
    names: string[]
    mappings: string
}

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
    return { emit, map: map.toSorted(([, ad], [, bd]) => ad.start - bd.start) }
}

export const createSourceMap = (
    outFilename: string,
    srcPath: string,
    src: string,
    out: string,
    map: [Span, Span][]
): SourceMap => {
    const lines = []
    let line = []
    let sLine: number | undefined
    let sCol: number | undefined
    let dLine: number | undefined
    let dCol: number | undefined

    for (const [sSpan, dSpan] of map) {
        const ms = []
        const sLoc = indexToLocation(sSpan.start, src)!
        const dLoc = indexToLocation(dSpan.start, out)!

        if (dLine !== undefined && dLine !== dLoc.line) {
            lines.push(line)
            line = []
            dCol = undefined
        }

        if (dCol !== undefined) {
            ms.push(dLoc.column - dCol)
        } else {
            ms.push(dLoc.column)
        }

        ms.push(0)

        if (sLine !== undefined) {
            ms.push(sLoc.line - sLine)
        } else {
            ms.push(sLoc.line)
        }

        if (sCol !== undefined) {
            ms.push(sLoc.column - sCol)
        } else {
            ms.push(sLoc.column)
        }

        dLine = dLoc.line
        dCol = dLoc.column
        sLine = sLoc.line
        sCol = sLoc.column

        line.push(ms.map(encode).join(''))
    }
    if (line.length > 0) {
        lines.push(line)
    }
    return {
        version: 3,
        file: outFilename,
        sourceRoot: '',
        sources: [srcPath],
        names: [],
        mappings: lines.join(';')
    }
}
