import { compactToken, flattenToken, parse } from './parser/parser'
import { tokenize } from './lexer/lexer'
import { readFileSync } from 'fs'
import { join, resolve } from 'path'
import { prettySourceMessage, prettySyntaxError } from './error'

const version = JSON.parse(readFileSync(join(__dirname, '..', 'package.json')).toString()).version

export const usage = `\
Nois transpiler - v${version}

Usage: nois file`

const path = process.argv.slice(2).at(0)
if (!path) {
    console.log(usage)
    process.exit()
}

const source = { str: readFileSync(resolve(path)).toString(), filename: path }

const token = parse(tokenize(source.str))
if ('expected' in token) {
    console.error(prettySourceMessage(prettySyntaxError(token), token.location.start, source))
    process.exit(1)
}

console.dir(compactToken(flattenToken(token)), { depth: null, colors: true, compact: true })
