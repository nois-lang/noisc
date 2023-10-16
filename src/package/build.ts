import { relative } from 'path'
import { buildModuleAst, Module } from '../ast'
import { prettyLexerError, prettySourceMessage, prettySyntaxError } from '../error'
import { erroneousTokenKinds, tokenize } from '../lexer/lexer'
import { parseModule } from '../parser/fns'
import { Parser } from '../parser/parser'
import { pathToVid } from '../scope'
import { VirtualIdentifier } from '../scope/vid'
import { Source } from '../source'
import { Package } from './index'
import { getPackageModuleSources } from './io'

export const buildPackage = (path: string, name: string): Package | undefined => {
    const modules = getPackageModuleSources(path).map(s => buildModule(s, pathToVid(relative(path, s.filepath), name)))
    if (modules.some(m => !m)) {
        return undefined
    }
    return { path, name, modules: <Module[]>modules }
}

export const buildModule = (source: Source, vid: VirtualIdentifier): Module | undefined => {
    const tokens = tokenize(source.code)
    const errorTokens = tokens.filter(t => erroneousTokenKinds.includes(t.kind))
    if (errorTokens.length > 0) {
        for (const t of errorTokens) {
            console.error(
                prettySourceMessage(prettyLexerError(t), t.location, source)
            )
        }
        return undefined
    }

    const parser = new Parser(tokens)
    parseModule(parser)
    const root = parser.buildTree()

    if (parser.errors.length > 0) {
        for (const error of parser.errors) {
            console.error(
                prettySourceMessage(prettySyntaxError(error), error.got.location, source)
            )
        }
        return undefined
    }

    return buildModuleAst(root, vid, source)
}
