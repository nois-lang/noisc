import { isNewline } from './lexer/lexer'
import { Source } from './source'

export interface Span {
    /**
     * Start position index of this span, inclusive
     */
    start: number
    /**
     * End position index of this span, exclusive
     */
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

export const prettyLineAt = (span: Span, source: Source): string => {
    const start = indexToLocation(span.start, source)
    const end = indexToLocation(span.end, source)
    if (!start || !end) return '<outside of a file>'
    const lineNumSize = start.line.toString().length
    const padSize = Math.max(6, 3 + lineNumSize)
    if (start.line === end.line) {
        const pad = '│ '.padStart(padSize)
        const linePad = `${(start.line + 1).toString()} │ `.padStart(padSize)
        const sourceLine = source.code.split('\n')[start.line]
        const line = linePad + sourceLine
        const highlightEnd = start.line === end.line ? end.column : sourceLine.length
        const highlightLen = highlightEnd - start.column
        const highlight = pad + ' '.repeat(start.column) + '^'.repeat(highlightLen)
        return [pad, line, highlight].join('\n')
    } else {
        const maxLinesKeep = 2
        const lines = source.code.split('\n').slice(start.line, end.line + 1)
        const first = '│┌'.padStart(padSize) + '─'.repeat(start.column) + '┐'
        const last = '│└'.padStart(padSize) + '─'.repeat(Math.max(0, end.column - 1)) + '┘'
        const tooLong = lines.length > maxLinesKeep * 2
        const linesErr = lines
            .flatMap((sourceLine, i) => {
                if (tooLong && i >= maxLinesKeep && i < lines.length - maxLinesKeep) {
                    if (i === maxLinesKeep) {
                        return ['...   '.padStart(padSize)]
                    }
                    return []
                }
                const lineNum = start.line + i + 1
                const linePad = `${lineNum.toString()} ││`.padStart(padSize)
                return [linePad + sourceLine]
            })
            .join('\n')
        return [first, linesErr, last].join('\n')
    }
}

export const locationToString = (location: Location): string => `${location.line + 1}:${location.column + 1}`
