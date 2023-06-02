import {LexerToken} from '../lexer/lexer'
import * as grammar from '../grammar.json' assert {type: 'json'}

export type ParserTokenName = 'program'

export interface ParserToken {
    name: ParserTokenName,
    nodes: Token[]
}

export type Token = LexerToken | ParserToken

export interface Rule {
    from: ParserTokenName,
    branches: Token[][]
}

export const rules: Rule[] = (<any>grammar).default.rules
