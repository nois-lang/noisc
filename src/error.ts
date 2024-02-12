import { LexerToken, TokenKind } from './lexer/lexer'
import { Span, indexToLocation, locationToString, prettyLineAt } from './location'
import { red, yellow } from './output'
import { Parser } from './parser'
import { Source } from './source'

export interface SyntaxError {
    expected: TokenKind[]
    got: LexerToken
    message?: string
}

export const syntaxError = (parser: Parser, message?: string): SyntaxError => {
    return { expected: [], got: parser.tokens[parser.pos], message }
}

export const prettyLexerError = (token: LexerToken): string => {
    return colorError(`lexer error: ${token.kind} token \`${token.value}\``)
}

export const prettySyntaxError = (error: SyntaxError): string => {
    const msg = error.message ?? `expected \`${error.expected.join(', ')}\``
    return colorError(`syntax error: ${msg}, got \`${error.got.kind}\``)
}

export const colorError = (message: string): string => {
    return red(message)
}

export const colorWarning = (message: string): string => {
    return yellow(message)
}

export const prettySourceMessage = (message: string, span: Span, source: Source): string => {
    const start = indexToLocation(span.start, source)!
    const locationStr = `${source.filepath}:${locationToString(start)}`
    const locationMsg = `${' '.repeat(2)}at ${locationStr}`
    return [message, locationMsg, prettyLineAt(span, source)].join('\n')
}
