import { LexerToken } from '../lexer/lexer'
import { ParseNode } from '../parser'
import { nameLikeTokens } from '../parser/fns'
import { Typed } from '../semantic'
import { Expr, UnaryExpr, buildExpr, buildOperandExpr } from './expr'
import { AstNode, filterNonAstNodes } from './index'
import { buildPrefixOp } from './op'
import { Identifier, Name, Operand, buildIdentifier, buildName, buildOperand } from './operand'
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
    pattern: Pattern
    block: Block
    guard?: Expr
}

export const buildMatchClause = (node: ParseNode): MatchClause => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    const pattern = buildPattern(nodes[idx++])
    const guard = nodes[idx].kind === 'guard' ? buildExpr(filterNonAstNodes(nodes[idx++])[1]) : undefined
    const block = buildBlock(nodes[idx++])
    return { kind: 'match-clause', parseNode: node, pattern, guard, block }
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

export type PatternExpr = Name | ConPattern | Operand | UnaryExpr | Hole

export const buildPatternExpr = (node: ParseNode): PatternExpr => {
    const nodes = filterNonAstNodes(node)
    if (nameLikeTokens.includes((<LexerToken>nodes[0]).kind)) {
        return buildName(nodes[0])
    }
    if (nodes[0].kind === 'con-pattern') {
        return buildConPattern(nodes[0])
    }
    if (nodes[0].kind === 'hole') {
        return buildHole(nodes[0])
    }
    if (nodes[0].kind === 'prefix-op') {
        const prefixOp = buildPrefixOp(nodes[0])
        const operand = buildOperand(nodes[1])
        return { kind: 'unary-expr', parseNode: node, prefixOp, operand }
    }
    return buildOperandExpr(node)
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
