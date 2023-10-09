import { ParseToken, TokenKind } from './lexer/lexer'
import { Location, locationToString, prettyLineAt } from './location'
import { red, yellow } from './output'
import { Parser } from './parser/parser'
import { Source } from './source'

export interface SyntaxError {
    expected: TokenKind[]
    got: ParseToken
    message?: string
}

export const syntaxError = (parser: Parser, message?: string): SyntaxError => {
    return { expected: [], got: parser.tokens[parser.pos], message }
}

export const prettyLexerError = (token: ParseToken): string => {
    return prettyError(`lexer error: ${token.kind} token \`${token.value}\``)
}

export const prettySyntaxError = (error: SyntaxError): string => {
    const msg = error.message ?? `expected \`${error.expected.join(', ')}\``
    return prettyError(`syntax error: ${msg}, got \`${error.got.kind}\``)
}

export const prettyError = (message: string): string => {
    return red(message)
}

export const prettyWarning = (message: string): string => {
    return yellow(message)
}

export const prettySourceMessage = (message: string, location: Location, source: Source): string => {
    const locationStr = `${location ? `${source.filepath}:${locationToString(location)}` : '<unknown location>'}`
    const locationMsg = `${' '.repeat(2)}at ${locationStr}`
    return [message, locationMsg, '\n' + prettyLineAt(location, source)].join('\n')
}
