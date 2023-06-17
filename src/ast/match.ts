import { buildExpr, buildOperandExpr, Expr } from './expr'
import { AstNode, filterNonAstNodes, Typed } from './index'
import { buildIdentifier, buildName, buildOperand, Identifier, Name } from './operand'
import { buildUnaryOp, SpreadOp } from './op'
import { Block, buildBlock } from './statement'
import { ParseNode } from '../parser'

export interface MatchExpr extends AstNode<'match-expr'>, Partial<Typed> {
    expr: Expr
    clauses: MatchClause[]
}

export const buildMatchExpr = (node: ParseNode): MatchExpr => {
    const nodes = filterNonAstNodes(node)
    const expr = buildExpr(nodes[0])
    const clauses = filterNonAstNodes(nodes[1]).map(buildMatchClause)
    return { kind: 'match-expr', parseNode: node, expr, clauses }
}

export interface MatchClause extends AstNode<'match-clause'>, Partial<Typed> {
    pattern: Pattern
    block: Block
    guard?: Expr
}

export const buildMatchClause = (node: ParseNode): MatchClause => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    const pattern = buildPattern(nodes[idx++])
    const guard = nodes[idx].kind === 'guard' ? buildExpr(filterNonAstNodes(nodes[idx++])[0]) : undefined
    const block = nodes[idx].kind === 'expr' ? <Block>{ statements: [buildExpr(nodes[idx++])] } : buildBlock(nodes[idx++])
    return { kind: 'match-clause', parseNode: node, pattern, guard, block }
}

export type Pattern = ConPattern | Expr | Hole

export const buildPattern = (node: ParseNode): Pattern => {
    const nodes = filterNonAstNodes(node)
    if (nodes[0].kind === 'con-pattern') {
        return buildConPattern(nodes[0])
    }
    if (nodes[0].kind === 'hole') {
        return buildHole(nodes[0])
    }
    if (nodes[0].kind === 'prefix-op') {
        const unaryOp = buildUnaryOp(nodes[0])
        const operand = buildOperand(nodes[1])
        return { kind: 'unary-expr', parseNode: node, unaryOp, operand }
    }
    return buildOperandExpr(node)
}

export interface ConPattern extends AstNode<'con-pattern'> {
    identifier: Identifier
    fieldPatterns: (FieldPattern | SpreadOp)[]
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

export const buildFieldPattern = (node: ParseNode): FieldPattern | SpreadOp => {
    const nodes = filterNonAstNodes(node)
    if (nodes[0].kind === 'spread-op') {
        return { kind: 'spread-op', parseNode: node }
    }
    const name = buildName(nodes[0])
    const pattern = nodes.at(1) ? buildPattern(nodes[1]) : undefined
    return { kind: 'field-pattern', parseNode: node, name, pattern }
}

export interface Hole extends AstNode<'hole'> {
}

export const buildHole = (node: ParseNode): Hole => {
    return { kind: 'hole', parseNode: node }
}