import { compactToken, flattenToken, parse } from './parser/parser'
import { tokenize } from './lexer/lexer'
import { inspect } from 'util'

const code = `\
let main = (): Unit {
} if`

const token = parse(tokenize(code))
if (token === true) {
    throw Error('parsing error: skipped root')
}
if ('expect' in token) {
    throw Error(`parsing error: ${inspect(token, { depth: null, colors: true })}`)
}

const flatten = flattenToken(token)
console.dir({ rule: flatten }, { depth: null, colors: true })
const compact = compactToken(flatten)
console.dir({ compact }, { depth: null, colors: true })
