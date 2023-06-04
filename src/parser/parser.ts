import { LexerToken, LexerTokenName, TokenLocation } from '../lexer/lexer'
import { generateParsingTable } from './table'
import { readFileSync } from 'fs'
import { join } from 'path'
import { inspect } from 'util'

export const parserTokenNames = <const>[
    'program',
    'statements',
    'statement',
    'variable-def',
    'type-def',
    'return-stmt',
    'block',
    'expr',
    'expr_',
    'sub-expr',
    'unary-expr',
    'paren-expr',
    'operand',
    'infix-operator',
    'prefix-op',
    'postfix-op',
    'args',
    'function-expr',
    'params',
    'param',
    'trailing-comma',
    'type',
    'type-params',
    'if-expr',
]
export type ParserTokenName = typeof parserTokenNames[number]

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

const rawRules = JSON.parse(readFileSync(join(__dirname, '..', 'grammar.json')).toString()).rules
export const rules: Map<ParserTokenName, Rule> = new Map(rawRules.map((r: Rule) => [r.name, r]))

export const generateTransforms = (tokens: LexerToken[], root: ParserTokenName = 'program'): Transform[] => {
    const table = generateParsingTable()
    const buffer = structuredClone(tokens)
    const chain: Transform[] = []

    const stack: TokenName[] = []
    stack.push('eof')
    stack.push(root)

    while (buffer.length > 0) {
        if (stack.at(-1)! === 'e') {
            stack.pop()
            continue
        }
        if (stack.at(-1)! === buffer[0].name) {
            buffer.splice(0, 1)
            stack.pop()
        } else {
            const transform = table.get(<ParserTokenName>stack.at(-1)!)?.get(buffer[0].name)
            if (!transform) {
                console.debug(inspect({ chain }, { depth: null, colors: true }))
                throw Error(`syntax error, expected ${stack.at(-1)}, got ${buffer[0].name}, at ${buffer[0].location.start}`)
            }
            chain.push(transform)
            stack.pop()
            stack.push(...structuredClone(transform.branch).reverse())
        }
    }

    return chain
}

export const generateTree = (tokens: LexerToken[], chain: Transform[]): Token | undefined => {
    const transform = chain.splice(0, 1)[0]
    if (isEmptyBranch(transform.branch)) {
        return
    }
    const nodes: Token[] = []
    transform.branch.forEach(t => {
        if (t === tokens[0].name) {
            nodes.push(tokens.splice(0, 1)[0])
        } else {
            const child = generateTree(tokens, chain)
            if (child) {
                nodes.push(child)
            }
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
        return { name: token.name, nodes: token.nodes.map(n => compactToken(n)) }
    } else {
        return { name: token.name, value: token.value }
    }
}

const isEmptyBranch = (branch: ParseBranch): boolean => branch.length === 1 && branch[0] === 'e'
