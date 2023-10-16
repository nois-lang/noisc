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
    for (let i = 0; i <= index; i++) {
        if (i === index) {
            return { line, column }
        }
        if (isNewline(source.code[i])) {
            line++
            column = 0
        } else {
            column++
        }
    }
    return undefined
}

export const prettyLineAt = (range: LocationRange, source: Source): string => {
    const start = indexToLocation(range.start, source)
    const end = indexToLocation(range.end, source)
    if (!start || !end) return '<outside of a file>'
    const pad = '| '.padStart(6)
    const line = prettyLine(start.line, source)
    const highlightLen = start.line === end.line ? range.end - range.start + 1 : line.length - start.column
    const highlight = pad + ' '.repeat(start.column) + '^'.repeat(highlightLen)
    return [pad, line, highlight].join('\n')
}

export const prettyLine = (lineIndex: number, source: Source): string => {
    const lines = source.code.split('\n')
    const line = lines[lineIndex]
    const lineNum = `${(lineIndex + 1).toString()} | `.padStart(6)
    return lineNum + line
}

export const locationToString = (location: Location): string => `${location.line + 1}:${location.column + 1}`
