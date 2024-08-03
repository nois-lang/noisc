import { Module, buildModuleAst } from '../ast'
import { Identifier } from '../ast/operand'
import { prettyLexerError, prettySourceMessage, prettySyntaxError } from '../error'
import { erroneousTokenKinds, tokenize } from '../lexer/lexer'
import { Parser } from '../parser'
import { parseModule } from '../parser/fns'
import { Context } from '../scope'
import { Source } from '../source'

export const buildModule = (
    source: Source,
    id: Identifier,
    // TODO: might be better off being separate `AstContext` with only errors and source
    ctx: Context,
    compiled = false
): Module | undefined => {
    const dummyModule: Module = <any>{ source: source }
    ctx.moduleStack.push(dummyModule)
    const tokens = tokenize(source.code)
    const errorTokens = tokens.filter(t => erroneousTokenKinds.includes(t.kind))
    if (errorTokens.length > 0) {
        for (const t of errorTokens) {
            console.error(prettySourceMessage(prettyLexerError(t), source, t.span))
        }
        return undefined
    }

    const parser = new Parser(tokens)
    parseModule(parser)
    const root = parser.buildTree()

    if (parser.errors.length > 0) {
        for (const error of parser.errors) {
            console.error(prettySourceMessage(prettySyntaxError(error), source, error.got.span))
        }
        return undefined
    }

    const mod = /mod\.no$/.test(source.filepath)
    const ast = buildModuleAst(root, id, source, mod, ctx, compiled)

    ctx.moduleStack.pop()
    return ast
}
