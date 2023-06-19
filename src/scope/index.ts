import { buildModuleAst, Module } from '../ast'
import { FnDef, ImplDef, Statement } from '../ast/statement'
import { SemanticError } from '../semantic'
import { readdirSync, readFileSync, statSync } from 'fs'
import { extname, join, relative } from 'path'
import { Source } from '../source'
import { erroneousTokenKinds, tokenize } from '../lexer/lexer'
import { prettyLexerError, prettySourceMessage, prettySyntaxError } from '../error'
import { indexToLocation } from '../location'
import { Parser } from '../parser/parser'
import { parseModule } from '../parser/fns'
import { isAssignable, typeToVirtual, VirtualType } from '../typecheck'
import { Identifier } from '../ast/operand'

export interface Context {
    modules: Module[]
    scopeStack: Scope[]
    errors: SemanticError[]
    implDef?: ImplDef
}

export interface Scope {
    statements: Statement[]
}

export interface VirtualIdentifier {
    scope: string[]
    name: string
}

export const vidToString = (vid: VirtualIdentifier): string => [...vid.scope, vid.name].join('::')

export const vidScopeToString = (vid: VirtualIdentifier) => vid.scope.join('::')

export const vidFromScope = (vid: VirtualIdentifier): VirtualIdentifier => ({
    scope: vid.scope.slice(0, -1),
    name: vid.scope.at(-1)!
})

export const idToVid = (id: Identifier): VirtualIdentifier => ({
    scope: id.scope.map(s => s.value),
    name: id.name.value
})

export const findImpl = (vId: VirtualIdentifier, type: VirtualType, ctx: Context): ImplDef | undefined => {
    // TODO: go through imports only
    return ctx.modules
        .flatMap(m => m.statements.filter(s => s.kind === 'impl-def').map(s => <ImplDef>s))
        .filter(i => !i.forKind || isAssignable(type, typeToVirtual(i.forKind), ctx))
        .find(i => i.identifier.name.value === vId.name)
}

export const findImplFn = (implDef: ImplDef, vid: VirtualIdentifier, ctx: Context): FnDef | undefined => {
    return implDef.block.statements
        .filter(s => s.kind === 'fn-def' && s.identifier.name.value === vid.name)
        .map(s => <FnDef>s).at(0)
}

export const buildStd = (): Module[] => {
    const srcPath = join(__dirname, '..')
    const stdPath = join(srcPath, 'std')
    const modulePaths = listFiles(stdPath).filter(f => extname(f).toLowerCase() === '.no')
    return modulePaths.map(path => {
        const vid = pathToVid(srcPath, path)
        const source = { str: readFileSync(path).toString(), filename: path }
        return buildModule(source, vid)
    })
}

export const pathToVid = (rootPath: string, path: string): VirtualIdentifier => {
    const rPath = relative(rootPath, path)
    const dirs = rPath.replace(/\.no$/, '').split('/')
    if (dirs.at(-1)!.toLowerCase() === 'index') {
        dirs.pop()
    }
    const scope = dirs.slice(0, -1)
    const name = dirs.at(-1)!
    return { scope, name }
}

export const listFiles = (dir: string): string[] => {
    return readdirSync(dir).flatMap(f => {
        const fPath = join(dir, f)
        return statSync(fPath).isDirectory() ? listFiles(fPath) : [fPath]
    })
}

export const buildModule = (source: Source, vid: VirtualIdentifier): Module => {
    const tokens = tokenize(source.str)
    const errorTokens = tokens.filter(t => erroneousTokenKinds.includes(t.kind))
    if (errorTokens.length > 0) {
        for (const t of errorTokens) {
            console.error(
                prettySourceMessage(prettyLexerError(t), indexToLocation(t.location.start, source)!, source)
            )
        }
        process.exit(1)
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
        process.exit(1)
    }

    return buildModuleAst(root, vid)
}
