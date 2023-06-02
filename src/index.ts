import {firstTokens, followTokens, rules} from './parser/parser'

console.table([...rules.values()].map(rule => [rule.name, firstTokens(rule.name), followTokens(rule.name)]))
