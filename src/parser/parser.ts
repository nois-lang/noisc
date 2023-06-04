import { LexerToken, LexerTokenName, TokenLocation } from '../lexer/lexer'
import { readFileSync } from 'fs'
import { join } from 'path'

export const parserTokenNames = <const>[
    'program',
    'statements',
    'statement',
    'variable-def',
    'type-def',
    'return-stmt',
    'expr',
    'operand',
    'infix-operator',
    'prefix-op',
    'postfix-op',
    'call-op',
    'args',
    'function-expr',
    'block',
    'params',
    'param',
    'trailing-comma',
    'type',
    'type-params',
    'if-expr'
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

export const parse = (tokens: LexerToken[], node: TokenName = 'program', index: number = 0): Token | boolean => {
    const rule = rules.get(<ParserTokenName>node)!
    if (rule) {
        for (const branch of rule.branches) {
            if (isEmptyBranch(branch)) return true
            const transform = { name: <ParserTokenName>node, branch }
            const branchToken = parseTransform(transform, tokens, index)
            if (branchToken) {
                return branchToken
            }
        }
        return false
    } else {
        return node === tokens[index].name ? tokens[index] : false
    }
}

const parseTransform = (transform: Transform, tokens: LexerToken[], index: number): Token | undefined => {
    const nodes = []
    for (const branchTokenName of transform.branch) {
        const branchToken = parse(tokens, branchTokenName, index)
        if (branchToken === true) continue
        if (branchToken === false) return undefined
        nodes.push(branchToken)
        index += tokenSize(branchToken)
    }
    return {
        name: transform.name,
        nodes: nodes,
        location: {
            start: (nodes.at(0) ?? tokens[0]).location.start,
            end: nodes.at(-1)?.location.end ?? tokens[0].location.start
        }
    }
}

const isEmptyBranch = (branch: ParseBranch): boolean => branch.length === 1 && branch[0] === 'e'

const tokenSize = (token: Token): number => {
    if ('nodes' in token) {
        return token.nodes.map(n => tokenSize(n)).reduce((a, b) => a + b, 0)
    } else {
        return 1
    }
}

export const flattenToken = (token: Token): Token => {
    if ('value' in token) {
        return token
    }
    const nodes = token.nodes.flatMap(t => {
        if (t.name.endsWith('_')) {
            if ('value' in t) { throw Error('cannot flatten lexer token') }
            return t.nodes.map(n => flattenToken(n))
        }

        return [flattenToken(t)]
    })
    return {
        name: token.name,
        nodes,
        location: token.location
    }
}

export const compactToken = (token: Token): any => {
    if ('nodes' in token) {
        return { name: token.name, nodes: token.nodes.map(n => compactToken(n)) }
    } else {
        return { name: token.name, value: token.value }
    }
}
