import { Module, buildModuleAst } from '../ast'
import { prettyLexerError, prettySourceMessage, prettySyntaxError } from '../error'
import { erroneousTokenKinds, tokenize } from '../lexer/lexer'
import { Parser } from '../parser'
import { parseModule } from '../parser/fns'
import { VirtualIdentifier } from '../scope/vid'
import { Source } from '../source'

export const buildModule = (source: Source, vid: VirtualIdentifier, compiled = false): Module | undefined => {
    const tokens = tokenize(source.code)
    const errorTokens = tokens.filter(t => erroneousTokenKinds.includes(t.kind))
    if (errorTokens.length > 0) {
        for (const t of errorTokens) {
            console.error(prettySourceMessage(prettyLexerError(t), t.span, source))
        }
        return undefined
    }

    const parser = new Parser(tokens)
    parseModule(parser)
    const root = parser.buildTree()

    if (parser.errors.length > 0) {
        for (const error of parser.errors) {
            console.error(prettySourceMessage(prettySyntaxError(error), error.got.span, source))
        }
        return undefined
    }

    return buildModuleAst(root, vid, source, compiled)
}
