import { Location, locationToString, prettyLineAt } from './location'
import { Source } from './source'
import { ParseToken, TokenKind } from './lexer/lexer'
import { red } from './output'

export interface SyntaxError {
    expected: TokenKind[],
    got: ParseToken,
    message?: string
}

export const prettyLexerError = (token: ParseToken): string => {
    return red(`lexer error: ${token.kind} token \`${token.value}\``)
}

export const prettySyntaxError = (error: SyntaxError): string => {
    const msg = error.message ?? `expected \`${error.expected.join(', ')}\``
    return red(`syntax error: ${msg}, got \`${error.got.kind}\``)
}

export const prettyError = (message: string): string => {
    return red(message)
}

export const prettySourceMessage = (message: string, location: Location, source: Source): string => {
    const locationStr = `${location ? `${source.filename}:${locationToString(location)}` : '<unknwon location>'}`
    const locationMsg = `${' '.repeat(2)}at ${locationStr}`
    return [message, locationMsg, '\n' + prettyLineAt(location, source, 1) + '\n'].join('\n')
}
