import { indexToLocation, prettyIndex, prettyLocation } from './location'
import { Source } from './source'
import { ParseToken, TokenKind } from './lexer/lexer'

export interface SyntaxError {
    expected: TokenKind[],
    got: ParseToken,
    message?: string
}

export const prettyLexerError = (token: ParseToken): string => {
    return `lexer error: unknown token \`${token.value}\``
}

export const prettySyntaxError = (error: SyntaxError): string => {
    if (error.message) {
        return `syntax error: ${error.message}`
    }
    return `syntax error: expected \`${error.expected}\`, got \`${error.got.kind}\``
}

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
