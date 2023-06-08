import { tokenize } from './lexer/lexer'
import { readFileSync } from 'fs'
import { join, resolve } from 'path'
import { compactNode, parseModule, Parser } from './parser/parser'
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

const tokens = tokenize(source.str)
const parser = new Parser(tokens)
parseModule(parser)
const root = parser.buildTree()

for (const error of parser.errors) {
    console.error(prettySourceMessage(prettySyntaxError(error), error.got.location.start, source))
    process.exit(1)
}

console.dir(compactNode(root), { depth: null, colors: true, compact: true })
