import {ParseBranch, ParserTokenName, rules, TokenName} from './parser'

export const firstTokens = (name: TokenName): Set<TokenName> => {
    const rule = rules.get(<ParserTokenName>name)
    if (rule) {
        return new Set(rule.branches.flatMap(b => branchFirstTokens(b)))
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

export const branchFirstTokens = (b: ParseBranch): TokenName[] => {
    let first = b.at(0)
    if (first) {
        return [...firstTokens(first)]
    } else {
        return []
    }
}

const canMatchEmpty = (token: TokenName): boolean => {
    const rule = rules.get(<ParserTokenName>token)
    if (rule) {
        return rule.branches.some(b => b.every(t => canMatchEmpty(t)))
    } else {
        return token === 'e'
    }
}

const nextTokens = (ruleName: ParserTokenName, branch: ParseBranch, token: TokenName): Set<TokenName> => {
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
                res.push(...nextTokens_(i + 1))
            }
        } else {
            res.push(...followTokens(ruleName))
        }
        return new Set(res)
    }
    return new Set(...matchIndexes.flatMap(nextTokens_))
}
