import {rules} from './parser/parser'
import {firstTokens, followTokens} from './parser/locate-token'
import {generateParsingTable} from './parser/table'

console.table([...rules.values()].map(rule => [rule.name, firstTokens(rule.name), followTokens(rule.name)]))

console.table([...generateParsingTable().entries()].map(([k, v]) => ({k, ...Object.fromEntries(v.entries())})))
