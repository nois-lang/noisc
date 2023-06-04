import { compactToken, flattenToken, parse } from './parser/parser'
import { tokenize } from './lexer/lexer'

const code = `\
let main = (): Unit {
}`
const token = parse(tokenize(code))
if (typeof token === 'boolean') throw Error('parsing error')
const flatten = flattenToken(token)
console.dir({ rule: flatten }, { depth: null, colors: true })
const compact = compactToken(flatten)
console.dir({ compact }, { depth: null, colors: true })
