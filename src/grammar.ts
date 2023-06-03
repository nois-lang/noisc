import { readFileSync, writeFileSync } from 'fs'
import { LexerTokenName, lexerTokenNames } from './lexer/lexer'

type RawTokenName = string

interface RawRule {
    name: RawTokenName,
    branches: RawTokenName[][]
}

const buildGrammar = (bnf: string): RawRule[] => {
    bnf = bnf.replace(/^\/\/.*$/, '')
    return bnf
        .split(';')
        .map(r => r.trim())
        .filter(r => r.length > 0)
        .map(r => {
            const [name, branches] = r.split('::=')
            return [name, branches]
        }).map(([name, branches]) => ({
            name: name.trim(),
            branches: branches.split('|')
                .map(b => b.trim())
                .map(b => b
                    .split(' ')
                    .map(token => token.toLowerCase().trim())
                    .filter(token => token !== 'todo')
                )
        }))
}

const verifyGrammar = (grammar: RawRule[]) => {
    grammar.forEach(r => {
        r.branches.forEach(b => {
            b.forEach(t => {
                if (!grammar.some(r => r.name === t) && !lexerTokenNames.includes(<LexerTokenName>t)) {
                    throw Error(`unknown lexer token \`${t}\``)
                }
            })
        })
    })
}

const bnf = readFileSync('src/grammar.bnf').toString()
const grammar = buildGrammar(bnf)
console.log({ grammar })
verifyGrammar(grammar)
const json = JSON.stringify({ rules: grammar }, undefined, 2)
console.log('generated json grammar', json)
writeFileSync('src/grammar.json', json)
