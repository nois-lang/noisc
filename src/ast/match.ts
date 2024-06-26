import { LexerToken } from '../lexer/lexer'
import { ParseNode, filterNonAstNodes } from '../parser'
import { nameLikeTokens } from '../parser/fns'
import { Context } from '../scope'
import { Typed } from '../semantic'
import { unreachable } from '../util/todo'
import { Expr, buildExpr } from './expr'
import { AstNode } from './index'
import {
    BoolLiteral,
    CharLiteral,
    FloatLiteral,
    Identifier,
    IntLiteral,
    Name,
    StringInterpolated,
    StringLiteral,
    buildBool,
    buildChar,
    buildIdentifier,
    buildName,
    buildString
} from './operand'
import { Block, buildBlock } from './statement'

export interface MatchExpr extends AstNode<'match-expr'>, Partial<Typed> {
    expr: Expr
    clauses: MatchClause[]
}

export const buildMatchExpr = (node: ParseNode, ctx: Context): MatchExpr => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    // skip match-keyword
    idx++
    const expr = buildExpr(nodes[idx++], ctx)
    const clauses = filterNonAstNodes(nodes[idx++]).map(n => buildMatchClause(n, ctx))
    return { kind: 'match-expr', parseNode: node, expr, clauses }
}

export interface MatchClause extends AstNode<'match-clause'> {
    patterns: Pattern[]
    block: Block
    guard?: Expr
}

export const buildMatchClause = (node: ParseNode, ctx: Context): MatchClause => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    const patterns = filterNonAstNodes(nodes[idx++]).map(c => buildPattern(c, ctx))
    const guard = nodes[idx].kind === 'guard' ? buildExpr(filterNonAstNodes(nodes[idx++])[1], ctx) : undefined
    const block = buildBlock(nodes[idx++], ctx)
    return { kind: 'match-clause', parseNode: node, patterns, guard, block }
}

export interface Pattern extends AstNode<'pattern'> {
    name?: Name
    expr: PatternExpr
}

export const buildPattern = (node: ParseNode, ctx: Context): Pattern => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    const name = nodes[idx].kind === 'pattern-bind' ? buildName(filterNonAstNodes(nodes[idx++])[0], ctx) : undefined
    const expr = buildPatternExpr(nodes[idx++], ctx)
    return { kind: 'pattern', parseNode: node, name, expr }
}

export type PatternExpr =
    | Name
    | ConPattern
    | ListPattern
    | Hole
    | StringLiteral
    | StringInterpolated
    | CharLiteral
    | IntLiteral
    | FloatLiteral
    | BoolLiteral

export const buildPatternExpr = (node: ParseNode, ctx: Context): PatternExpr => {
    const n = filterNonAstNodes(node)[0]
    if (nameLikeTokens.includes((<LexerToken>n).kind)) {
        return buildName(n, ctx)
    }
    switch (n.kind) {
        case 'name':
            return buildName(n, ctx)
        case 'con-pattern':
            return buildConPattern(n, ctx)
        case 'list-pattern':
            return buildListPattern(n, ctx)
        case 'hole':
            return buildHole(n)
        case 'number':
            return buildNumber(n, ctx)
        case 'string':
            return buildString(n, ctx)
        case 'char':
            return buildChar(n, ctx)
        case 'bool':
            return buildBool(n, ctx)
        default:
            return unreachable(n.kind)
    }
}

export interface ConPattern extends AstNode<'con-pattern'>, Partial<Typed> {
    identifier: Identifier
    fieldPatterns: FieldPattern[]
}

export const buildConPattern = (node: ParseNode, ctx: Context): ConPattern => {
    const nodes = filterNonAstNodes(node)
    const identifier = buildIdentifier(nodes[0], ctx)
    const fieldPatterns = filterNonAstNodes(nodes[1]).map(n => buildFieldPattern(n, ctx))
    return { kind: 'con-pattern', parseNode: node, identifier, fieldPatterns }
}

export interface ListPattern extends AstNode<'list-pattern'>, Partial<Typed> {
    itemPatterns: Pattern[]
}

export const buildListPattern = (node: ParseNode, ctx: Context): ListPattern => {
    const nodes = filterNonAstNodes(node)
    return { kind: 'list-pattern', parseNode: node, itemPatterns: nodes.map(n => buildPattern(n, ctx)) }
}

export interface FieldPattern extends AstNode<'field-pattern'> {
    name: Name
    pattern?: Pattern
}

export const buildFieldPattern = (node: ParseNode, ctx: Context): FieldPattern => {
    const nodes = filterNonAstNodes(node)
    const name = buildName(nodes[0], ctx)
    const pattern = nodes.at(1) ? buildPattern(nodes[1], ctx) : undefined
    return { kind: 'field-pattern', parseNode: node, name, pattern }
}

export interface Hole extends AstNode<'hole'>, Partial<Typed> {}

export const buildHole = (node: ParseNode): Hole => {
    return { kind: 'hole', parseNode: node }
}

export const buildNumber = (node: ParseNode, ctx: Context): IntLiteral | FloatLiteral => {
    const nodes = filterNonAstNodes(node)
    const n = nodes.at(-1)!
    const sign = nodes[0].kind === 'minus' ? '-' : ''
    if (n.kind === 'int') {
        return { kind: 'int-literal', parseNode: node, value: sign + n.value }
    }
    if (n.kind === 'float') {
        return { kind: 'float-literal', parseNode: node, value: sign + n.value }
    }
    throw Error(`expected number, got ${node.kind}`)
}
