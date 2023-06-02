import {ParserTokenName, rules, Transform} from './parser'
import {LexerTokenName} from '../lexer/lexer'
import {followTokens, transformFirstTokens} from './locate-token'

export type ParsingTable = Map<ParserTokenName, Map<LexerTokenName, Transform>>

export const generateParsingTable = (): ParsingTable => {
    const table: ParsingTable = new Map()
    rules.forEach(r => {
        const ruleMap: Map<LexerTokenName, Transform> = new Map()
        r.branches.forEach(b => {
            if (b.length === 1 && b.includes('e')) {
                followTokens(r.name).forEach(ft => {
                    ruleMap.set(<LexerTokenName>ft, {name: r.name, branch: b})
                })
            } else {
                transformFirstTokens({name: r.name, branch: b}).forEach(t => {
                    ruleMap.set(<LexerTokenName>t, {name: r.name, branch: b})
                })
            }
        })
        table.set(r.name, ruleMap)
    })
    return table
}
