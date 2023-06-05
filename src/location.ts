import { isNewline } from './lexer/lexer'
import { Source } from './source'

export interface LocationRange {
    start: number
    end: number
}

export interface Location {
    line: number,
    column: number
}

export const indexToLocation = (index: number, source: Source): Location | undefined => {
    let line = 0
    let column = 0
    for (let i = 0; i <= index; i++) {
        if (i === index) {
            return { line, column }
        }
        if (isNewline(source.str[i])) {
            line++
            column = 0
        } else {
            column++
        }
    }
    return undefined
}

export const prettyIndex = (index: number, source: Source): string => {
    const start = indexToLocation(index, source)
    if (!start) return '<outside of a file>'

    const lines = source.str.split('\n')
    const line = lines[start.line]
    const highlight = ' '.repeat(start.column) + '^'
    const lineNum = `${start.line + 1} | `
    return `\
    
${lineNum}${line}
${' '.repeat(lineNum.length)}${highlight}`
}

export const prettyLocation = (location: Location): string => `${location.line + 1}:${location.column + 1}`
