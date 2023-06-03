import { LexerToken, LexerTokenName, TokenLocation } from '../lexer/lexer'
import * as grammar from '../grammar.json' assert { type: 'json' }
import { generateParsingTable } from './table'

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
    location: TokenLocation,
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

export const generateTransforms = (tokens: LexerToken[], root: ParserTokenName = 'program'): Transform[] => {
    const table = generateParsingTable()
    const buffer = structuredClone(tokens)
    const chain: Transform[] = []

    const stack: TokenName[] = []
    stack.push('eof')
    stack.push(root)

    while (buffer.length > 0) {
        if (stack.at(-1)! === buffer[0].name) {
            buffer.splice(0, 1)
            stack.pop()
        } else {
            const transform = table.get(<ParserTokenName>stack.at(-1)!)?.get(buffer[0].name)
            if (!transform) {
                throw Error(`syntax error, expected ${stack.at(-1)}, got ${buffer[0].name}`)
            }
            chain.push(transform)
            stack.pop()
            stack.push(...structuredClone(transform.branch).reverse())
        }
    }

    return chain
}

export const generateTree = (tokens: LexerToken[], chain: Transform[]): Token => {
    const transform = chain.splice(0, 1)[0]
    const nodes: Token[] = []
    transform.branch.forEach(t => {
        if (t === tokens[0].name) {
            nodes.push(tokens.splice(0, 1)[0])
        } else {
            nodes.push(generateTree(tokens, chain))
        }
    })
    return {
        name: transform.name,
        location: {
            start: (nodes.at(0) ?? tokens[0]).location.start,
            end: nodes.at(-1)?.location.end ?? tokens[0].location.start
        },
        nodes
    }
}

export const compactToken = (token: Token): any => {
    if ('nodes' in token) {
        return Object.fromEntries(token.nodes.map(n => [n.name, compactToken(n)]))
    } else {
        return token.value
    }
}
