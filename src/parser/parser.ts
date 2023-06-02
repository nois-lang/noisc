import {LexerToken, LexerTokenName} from '../lexer/lexer'
import * as grammar from '../grammar.json' assert {type: 'json'}

export type ParserTokenName
    = 'program'
    | 'statement'
    | 'function-def'
    | 'params'
    | 'params_'
    | 'param'
    | 'trailing-comma'
    | 'block'
    | 'block_'

export interface ParserToken {
    name: ParserTokenName,
    nodes: Token[]
}

export type TokenName = LexerTokenName | ParserTokenName
export type Token = LexerToken | ParserToken

export interface Transform {
    name: ParserTokenName,
    branch: ParseBranch
}

export interface Rule {
    name: ParserTokenName,
    branches: ParseBranch[]
}

export type ParseBranch = TokenName[]

const rawRules = (<any>grammar).default.rules
export const rules: Map<ParserTokenName, Rule> = new Map(rawRules.map((r: Rule) => [r.name, r]))
