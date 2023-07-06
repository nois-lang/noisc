import { AstNode, buildModuleAst, Module } from '../ast'
import { FnDef, ImplDef, KindDef, Statement } from '../ast/statement'
import { Source } from '../source'
import { erroneousTokenKinds, tokenize } from '../lexer/lexer'
import { prettyLexerError, prettySourceMessage, prettySyntaxError } from '../error'
import { indexToLocation } from '../location'
import { Parser } from '../parser/parser'
import { parseModule } from '../parser/fns'
import { isAssignable, typeToVirtual, VirtualType } from '../typecheck'
import { VirtualIdentifier } from './vid'
import { Config } from '../config'

export interface Context {
    config: Config
    modules: Module[]
    scopeStack: Scope[]
    errors: SemanticError[]
    warnings: SemanticError[]

    module?: Module
    implDef?: ImplDef
    kindDef?: KindDef
}

export interface Scope {
    statements: Map<VirtualIdentifier, Statement>
}

export interface SemanticError {
    module: Module,
    node: AstNode<any>
    message: string
}

export const semanticError = (ctx: Context, node: AstNode<any>, message: string): SemanticError =>
    ({ module: ctx.module!, node, message })

export const findImpl = (vId: VirtualIdentifier, type: VirtualType, ctx: Context): ImplDef | undefined => {
    // TODO: go through imports only
    return ctx.modules
        .flatMap(m => m.block.statements.filter(s => s.kind === 'impl-def').map(s => <ImplDef>s))
        .filter(i => !i.forKind || isAssignable(type, typeToVirtual(i.forKind), ctx))
        .find(i => i.identifier.name.value === vId.name)
}

export const findImplFn = (implDef: ImplDef, vid: VirtualIdentifier, ctx: Context): FnDef | undefined => {
    return implDef.block.statements
        .filter(s => s.kind === 'fn-def' && s.identifier.name.value === vid.name)
        .map(s => <FnDef>s).at(0)
}

export const pathToVid = (path: string, packageName?: string): VirtualIdentifier => {
    const dirs = path.replace(/\.no$/, '').split('/')
    if (packageName) {
        dirs.unshift(packageName)
    }
    if (dirs.at(-1)!.toLowerCase() === 'index') {
        dirs.pop()
    }
    const scope = dirs.slice(0, -1)
    const name = dirs.at(-1)!
    return { scope, name }
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
