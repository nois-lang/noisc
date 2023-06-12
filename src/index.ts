import { erroneousTokenKinds, tokenize } from './lexer/lexer'
import { existsSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { compactNode, Parser } from './parser/parser'
import { prettyLexerError, prettySourceMessage, prettySyntaxError } from './error'
import { parseModule } from './parser/fns'


const version = JSON.parse(readFileSync(join(__dirname, '..', 'package.json')).toString()).version

export const usage = `\
Nois transpiler - v${version}

Usage: nois file`

const path = process.argv.slice(2).at(0)
if (!path) {
    console.log(usage)
    process.exit()
}
const sourcePath = resolve(path)
if (!existsSync(sourcePath)) {
    console.error(`no such file \`${path}\``)
    process.exit()
}
const source = { str: readFileSync(sourcePath).toString(), filename: path }

const tokens = tokenize(source.str)
const errorTokens = tokens.filter(t => erroneousTokenKinds.includes(t.kind))
if (errorTokens.length > 0) {
    for (const t of errorTokens) {
        console.error(prettySourceMessage(prettyLexerError(t), t.location.start, source))
    }
    process.exit(1)
}

const parser = new Parser(tokens)
parseModule(parser)
const root = parser.buildTree()

if (parser.errors.length > 0) {
    for (const error of parser.errors) {
        console.error(prettySourceMessage(prettySyntaxError(error), error.got.location.start, source))
    }
    process.exit(1)
}

console.dir(compactNode(root), { depth: null, colors: true, compact: true })
