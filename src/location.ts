import { isNewline } from './lexer/lexer'
import { Source } from './source'

export interface LocationRange {
    start: number
    end: number
}

export interface Location {
    line: number
    column: number
}

export const indexToLocation = (index: number, source: Source): Location | undefined => {
    let line = 0
    let column = 0
    for (let i = 0; i < index; i++) {
        if (isNewline(source.code[i])) {
            line++
            column = 0
        } else {
            column++
        }
    }
    return { line, column }
}

export const prettyLineAt = (range: LocationRange, source: Source): string => {
    const start = indexToLocation(range.start, source)
    const end = indexToLocation(range.end, source)
    if (!start || !end) return '<outside of a file>'
    const lineNumSize = start.line.toString().length
    const padSize = Math.max(6, 3 + lineNumSize)
    const pad = '| '.padStart(padSize)
    const linePad = `${(start.line + 1).toString()} | `.padStart(padSize)
    if (start.line === end.line) {
        const sourceLine = source.code.split('\n')[start.line]
        const line = linePad + sourceLine
        const lastLineColumn = sourceLine.length - 1
        const highlightEnd = end.column === sourceLine.length && start.line !== end.line ? end.column : lastLineColumn
        const highlightLen = highlightEnd + 1 - start.column
        const highlight = pad + ' '.repeat(start.column) + '^'.repeat(highlightLen)
        return [pad, line, highlight].join('\n')
    } else {
        const lines = source.code.split('\n').slice(start.line, end.line + 1)
        const first = pad + '-'.repeat(start.column) + 'v'.repeat(lines[0].length - start.column)
        const last = pad + '-'.repeat(end.column - 1) + '^'.repeat(lines.at(-1)!.length - end.column + 1)
        const linesErr = lines
            .map((sourceLine, i) => {
                let lineNum = start.line + i + 1
                const isPartialHighlight = i === 0 || i === lines.length - 1
                const linePad = `${lineNum.toString()} |${isPartialHighlight ? ' ' : '>'}`.padStart(padSize)
                return linePad + sourceLine
            })
            .join('\n')
        return [first, linesErr, last].join('\n')
    }
}

export const locationToString = (location: Location): string => `${location.line + 1}:${location.column + 1}`
