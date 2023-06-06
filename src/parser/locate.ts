import { LexerTokenName } from '../lexer/lexer'
import { ParseBranch, ParserTokenName, rules, TokenName, Transform } from './parser'

export const firstTokens = (token: TokenName): Set<LexerTokenName> => {
    const rule = rules.get(<ParserTokenName>token)
    if (rule) {
        return new Set(rule.branches.flatMap(b => [...transformFirstTokens({
            name: <ParserTokenName>token,
            branch: b
        })]))
    } else {
        return new Set([<LexerTokenName>token])
    }
}

const transformFirstTokens = (transform: Transform, index: number = 0): Set<LexerTokenName> => {
    if (index >= transform.branch.length) {
        return new Set()
    }
    const tokens: Set<LexerTokenName> = new Set()
    const t = <LexerTokenName>transform.branch[index]
    const rule = rules.get(<ParserTokenName>t)
    if (rule) {
        if (canMatchEmpty(rule.name)) {
            transformFirstTokens(transform, index + 1).forEach(t => tokens.add(t))
        }
        firstTokens(rule.name).forEach(t => tokens.add(t))
    } else {
        tokens.add(t)
    }
    return tokens
}

const canMatchEmpty = (token: TokenName): boolean => {
    const rule = rules.get(<ParserTokenName>token)
    if (rule) {
        return rule.branches.some(b => branchCanMatchEmpty(b))
    } else {
        return token === 'e'
    }
}

const branchCanMatchEmpty = (branch: ParseBranch): boolean => {
    for (let t of branch) {
        if (!canMatchEmpty(t)) {
            return false
        }
    }
    return true
}
