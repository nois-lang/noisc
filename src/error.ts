import { TokenName } from './parser/parser'
import { indexToLocation, LocationRange, prettyIndex, prettyLocation } from './location'
import { Source } from './source'

export interface SyntaxErrorInfo {
    expect: TokenName[],
    got: TokenName,
    location: LocationRange
}

export const prettySyntaxError = (error: SyntaxErrorInfo): string =>
    `syntax error: expected \`${error.expect}\`, got \`${error.got}\``

export const prettySourceMessage = (message: string, index: number, source: Source): string => {
    const location = indexToLocation(index, source)
    const locationStr = `${location ? `${source.filename}:${prettyLocation(location)}` : '<unknwon location>'}`
    const indent = ' '.repeat(4)
    return `\
${prettyIndex(index, source)}
${message}
${indent}at ${locationStr}
`
}
