import { compactToken, flattenToken, parse } from './parser/parser'
import { tokenize } from './lexer/lexer'
import { inspect } from 'util'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const path = process.argv.slice(2).at(0)
if (!path) {
    throw Error('no file provided')
}

const code = readFileSync(resolve(path)).toString()

const token = parse(tokenize(code))
if (token === true) {
    throw Error('parsing error: skipped root')
}
if ('expect' in token) {
    throw Error(`parsing error: ${inspect(token, { depth: null, colors: true })}`)
}

console.dir(compactToken(flattenToken(token)), { depth: null, colors: true, compact: true })
