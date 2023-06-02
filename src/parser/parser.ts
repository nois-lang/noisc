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

export interface Rule {
    name: ParserTokenName,
    branches: TokenName[][]
}

const rawRules = (<any>grammar).default.rules
export const rules: Map<ParserTokenName, Rule> = new Map(rawRules.map((r: Rule) => [r.name, r]))

export const firstTokens = (name: TokenName): Set<TokenName> => {
    const rule = rules.get(<ParserTokenName>name)
    if (rule) {
        return new Set(rule.branches.flatMap(b => {
            let first = b.at(0)
            if (first) {
                return [...firstTokens(first)]
            } else {
                return []
            }
        }))
    } else {
        return new Set([name])
    }
}

export const followTokens = (name: TokenName): Set<TokenName> => {
    const rule = rules.get(<ParserTokenName>name)
    if (rule) {
        const appearsInRules = [...rules.values()].filter(r => r.branches.some(b => b.includes(name)))
        const follows = new Set(
            appearsInRules.flatMap(rule => rule.branches
                .filter(b => b.includes(name))
                .flatMap(b => [...nextTokens(rule.name, b, name)]))
        )
        if (follows.size === 0) {
            return new Set(['eof'])
        }
        return follows
    } else {
        return new Set([name])
    }
}

const nextTokens = (ruleName: ParserTokenName, branch: TokenName[], token: TokenName): Set<TokenName> => {
    if (ruleName === token) {
        return new Set()
    }
    const matchIndexes = branch.map((t, i) => <const>[t, i]).filter(([t,]) => t === token).map(([, i]) => i)
    const nextTokens_ = (i: number) => {
        const next = branch.at(i + 1)
        const res: TokenName[] = []
        if (next) {
            res.push(...[...firstTokens(next)].filter(t => t !== 'e'))
            if (canMatchEmpty(next)) {
                console.log('can match empty', token, next)
                res.push(...nextTokens_(i + 1))
            }
        } else {
            res.push(...followTokens(ruleName))
        }
        return new Set(res)
    }
    return new Set(...matchIndexes.flatMap(nextTokens_))
}

const canMatchEmpty = (token: TokenName): boolean => {
    const rule = rules.get(<ParserTokenName>token)
    if (rule) {
        return rule.branches.some(b => b.every(t => canMatchEmpty(t)))
    } else {
        return token === 'e'
    }
}
