import { buildModuleAst, Module } from '../ast'
import { getPackageModuleSources } from './io'
import { pathToVid } from '../scope'
import { relative } from 'path'
import { Source } from '../source'
import { VirtualIdentifier } from '../scope/vid'
import { erroneousTokenKinds, tokenize } from '../lexer/lexer'
import { prettyLexerError, prettySourceMessage, prettySyntaxError } from '../error'
import { indexToLocation } from '../location'
import { Parser } from '../parser/parser'
import { parseModule } from '../parser/fns'

export interface Package {
    path: string
    name: string
    modules: Module[]
}

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
                prettySourceMessage(prettyLexerError(t), indexToLocation(t.location.start, source)!, source)
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
                prettySourceMessage(prettySyntaxError(error), indexToLocation(error.got.location.start, source)!, source)
            )
        }
        return undefined
    }

    return buildModuleAst(root, vid, source)
}
