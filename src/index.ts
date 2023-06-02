import {rules} from './parser/parser'
import {firstTokens, followTokens} from './parser/locate-token'

console.table([...rules.values()].map(rule => [rule.name, firstTokens(rule.name), followTokens(rule.name)]))
