import { ParseBranch, ParserTokenName, rules, TokenName, Transform } from './parser'

export const firstTokens = (token: TokenName): Set<TokenName> => {
    const rule = rules.get(<ParserTokenName>token)
    if (rule) {
        return new Set(rule.branches.flatMap(b => [...transformFirstTokens({
            name: <ParserTokenName>token,
            branch: b
        })]))
    } else {
        return new Set([token])
    }
}

export const transformFirstTokens = (transform: Transform, index: number = 0): Set<TokenName> => {
    if (index >= transform.branch.length) {
        return new Set()
    }
    const tokens: Set<TokenName> = new Set()
    const t = transform.branch[index]
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

export const followTokens = (name: TokenName): Set<TokenName> => {
    const rule = rules.get(<ParserTokenName>name)
    if (rule) {
        const appears = appearsInRules(name)
        const follows = new Set(
            appears.flatMap(rule => rule.branches
                .filter(b => b.includes(name))
                .flatMap(b => [...nextTokens({ name: rule.name, branch: b }, name)]))
        )
        if (follows.size === 0) {
            return new Set(['eof'])
        }
        return follows
    } else {
        return new Set()
    }
}

const nextTokens = (transform: Transform, token: TokenName): Set<TokenName> => {
    if (transform.name === token) {
        return new Set()
    }
    const matchIndexes = transform.branch.map((t, i) => <const>[t, i]).filter(([t,]) => t === token).map(([, i]) => i)
    const nextTokens_ = (i: number) => {
        const res: TokenName[] = []
        const next = transform.branch.at(i + 1)
        if (next) {
            res.push(...[...firstTokens(next)].filter(t => t !== 'e'))
            if (canMatchEmpty(next)) {
                res.push(...nextTokens_(i + 1))
            }
        } else {
            res.push(...followTokens(transform.name))
        }
        return new Set(res)
    }
    return new Set(...matchIndexes.flatMap(nextTokens_))
}

const appearsInRules = (name: TokenName) => [...rules.values()].filter(r => r.branches.some(b => b.includes(name)))

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
