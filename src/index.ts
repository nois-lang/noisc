import {generateTransforms, generateTree, rules} from './parser/parser'
import {followTokens, transformFirstTokens} from './parser/locate-token'
import {generateParsingTable} from './parser/table'
import {tokenize} from './lexer/lexer'
import {inspect} from 'util'

const transforms = [...rules.values()].flatMap(r => r.branches.map(b => ({name: r.name, branch: b})))
console.table(transforms.map(t => [t.name, transformFirstTokens(t), followTokens(t.name)]))

console.table([...generateParsingTable().entries()].map(([k, v]) => ({k, ...Object.fromEntries([...v.entries()].map(([k, t]) => [k, t.branch]))})))

const code = `\
fn main(): Unit {
}`
const tokens = tokenize(code)
console.log({tokens})
const chain = generateTransforms(tokens)
console.log(inspect({chain}, {depth: null, colors: true}))
const rule = generateTree(tokens, chain)
console.log(inspect({rule}, {depth: null, colors: true}))
