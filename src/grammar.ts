import {readFileSync, writeFileSync} from 'fs'

type RawTokenName = string

interface RawRule {
    name: RawTokenName,
    branches: RawTokenName[][]
}

const buildGrammar = (bnf: string): RawRule[] => {
    console.log(bnf)
    bnf = bnf.replace(/^\/\/.*$/, '')
    return bnf.split(';').map(r => {
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

const bnf = readFileSync('src/grammar.bnf').toString()
const grammar = buildGrammar(bnf)
const json = JSON.stringify({rules: grammar}, undefined, 2)
console.log('generated json grammar', json)
writeFileSync('src/grammar.json', json)
