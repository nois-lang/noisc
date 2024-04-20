import { LexerToken } from '../lexer/lexer'
import { ParseNode, filterNonAstNodes } from '../parser'
import { nameLikeTokens } from '../parser/fns'
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

export const buildMatchExpr = (node: ParseNode): MatchExpr => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    // skip match-keyword
    idx++
    const expr = buildExpr(nodes[idx++])
    const clauses = filterNonAstNodes(nodes[idx++]).map(buildMatchClause)
    return { kind: 'match-expr', parseNode: node, expr, clauses }
}

export interface MatchClause extends AstNode<'match-clause'> {
    patterns: Pattern[]
    block: Block
    guard?: Expr
}

export const buildMatchClause = (node: ParseNode): MatchClause => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    const patterns = filterNonAstNodes(nodes[idx++]).map(c => buildPattern(c))
    const guard = nodes[idx].kind === 'guard' ? buildExpr(filterNonAstNodes(nodes[idx++])[1]) : undefined
    const block = buildBlock(nodes[idx++])
    return { kind: 'match-clause', parseNode: node, patterns, guard, block }
}

export interface Pattern extends AstNode<'pattern'> {
    name?: Name
    expr: PatternExpr
}

export const buildPattern = (node: ParseNode): Pattern => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    const name = nodes[idx].kind === 'pattern-bind' ? buildName(filterNonAstNodes(nodes[idx++])[0]) : undefined
    const expr = buildPatternExpr(nodes[idx++])
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

export const buildPatternExpr = (node: ParseNode): PatternExpr => {
    const n = filterNonAstNodes(node)[0]
    if (nameLikeTokens.includes((<LexerToken>n).kind)) {
        return buildName(n)
    }
    switch (n.kind) {
        case 'name':
            return buildName(n)
        case 'con-pattern':
            return buildConPattern(n)
        case 'list-pattern':
            return buildListPattern(n)
        case 'hole':
            return buildHole(n)
        case 'number':
            return buildNumber(n)
        case 'string':
            return buildString(n)
        case 'char':
            return buildChar(n)
        case 'bool':
            return buildBool(n)
        default:
            return unreachable(n.kind)
    }
}

export interface ConPattern extends AstNode<'con-pattern'>, Partial<Typed> {
    identifier: Identifier
    fieldPatterns: FieldPattern[]
}

export const buildConPattern = (node: ParseNode): ConPattern => {
    const nodes = filterNonAstNodes(node)
    const identifier = buildIdentifier(nodes[0])
    const fieldPatterns = filterNonAstNodes(nodes[1]).map(buildFieldPattern)
    return { kind: 'con-pattern', parseNode: node, identifier, fieldPatterns }
}

export interface ListPattern extends AstNode<'list-pattern'>, Partial<Typed> {
    itemPatterns: Pattern[]
}

export const buildListPattern = (node: ParseNode): ListPattern => {
    const nodes = filterNonAstNodes(node)
    return { kind: 'list-pattern', parseNode: node, itemPatterns: nodes.map(buildPattern) }
}

export interface FieldPattern extends AstNode<'field-pattern'> {
    name: Name
    pattern?: Pattern
}

export const buildFieldPattern = (node: ParseNode): FieldPattern => {
    const nodes = filterNonAstNodes(node)
    const name = buildName(nodes[0])
    const pattern = nodes.at(1) ? buildPattern(nodes[1]) : undefined
    return { kind: 'field-pattern', parseNode: node, name, pattern }
}

export interface Hole extends AstNode<'hole'>, Partial<Typed> {}

export const buildHole = (node: ParseNode): Hole => {
    return { kind: 'hole', parseNode: node }
}

export const buildNumber = (node: ParseNode): IntLiteral | FloatLiteral => {
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
