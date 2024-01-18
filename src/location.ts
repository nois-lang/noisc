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
    const linePad = `${(start.line + 1).toString()} | `.padStart(6)
    const pad = '| '.padStart(6)
    const sourceLine = source.code.split('\n')[start.line]
    const line = linePad + sourceLine
    // TODO: multiline highlight
    // why special logic is needed when token is near EOL?
    const highlightLen =
        end.column === sourceLine.length
            ? sourceLine.length - start.column
            : (start.line === end.line ? end.column : sourceLine.length) + 1 - start.column
    const highlight = pad + ' '.repeat(start.column) + '^'.repeat(highlightLen)
    return [pad, line, highlight].join('\n')
}

export const locationToString = (location: Location): string => `${location.line + 1}:${location.column + 1}`
