import { indexToLocation, prettyIndex, prettyLocation } from './location'
import { Source } from './source'
import { ParseToken, TokenKind } from './lexer/lexer'
import { red } from './output'

export interface SyntaxError {
    expected: TokenKind[],
    got: ParseToken,
    message?: string
}

export const prettyLexerError = (token: ParseToken): string => {
    return red(`lexer error: unknown token \`${token.value}\``)
}

export const prettySyntaxError = (error: SyntaxError): string => {
    const msg = error.message ?? `expected \`${error.expected.join(', ')}\``
    return red(`syntax error: ${msg}, got \`${error.got.kind}\``)
}

export const prettySourceMessage = (message: string, index: number, source: Source): string => {
    const location = indexToLocation(index, source)
    const locationStr = `${location ? `${source.filename}:${prettyLocation(location)}` : '<unknwon location>'}`
    const locationMsg = `${' '.repeat(2)}at ${locationStr}`
    return [message, locationMsg, '\n' + prettyIndex(index, source, 1) + '\n'].join('\n')
}
