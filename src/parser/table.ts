import {ParseBranch, ParserTokenName, rules} from './parser'
import {LexerTokenName} from '../lexer/lexer'
import {branchFirstTokens, followTokens} from './locate-token'
import {todo} from '../todo'

export interface Transform {
    name: ParserTokenName,
    branch: ParseBranch
}

export type ParsingTable = Map<ParserTokenName, Map<LexerTokenName, Transform>>

export const generateParsingTable = (): ParsingTable => {
    const table: ParsingTable = new Map()
    rules.forEach(r => {
        const ruleMap: Map<LexerTokenName, Transform> = new Map()
        r.branches.forEach(b => {
            const fts = branchFirstTokens(b)
            if (fts.length !== 1) {
                return todo()
            }
            const t = fts[0]
            if (t !== 'e') {
                ruleMap.set(<LexerTokenName>t, {name: r.name, branch: b})
            } else {
                followTokens(r.name).forEach(ft => {
                    ruleMap.set(<LexerTokenName>ft, {name: r.name, branch: b})
                })
            }
        })
        table.set(r.name, ruleMap)
    })
    return table
}
