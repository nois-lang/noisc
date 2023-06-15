import { buildOperandExpr, Expr } from './expr'
import { Block } from './statement'
import { AstNode, filterNonAstNodes } from './index'
import { ParseNode } from '../parser/parser'
import { todo } from '../todo'
import { buildOperand, Identifier } from './operand'
import { buildUnaryOp, SpreadOp } from './op'

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
        return { type: 'unary-expr', parseNode: node, unaryOp, operand }
    }
    return buildOperandExpr(nodes[0])
}

export interface ConPattern extends AstNode<'con-pattern'> {
    identifier: Identifier
    fieldPatterns: (FieldPattern | SpreadOp)[]
}

export const buildConPattern = (node: ParseNode): ConPattern => {
    return todo()
}

export interface FieldPattern extends AstNode<'field-pattern'> {
    identifier: Identifier
    fieldPatterns: FieldPattern[]
}

export const buildFieldPattern = (node: ParseNode): FieldPattern | SpreadOp => {
    return todo()
}

export interface Hole extends AstNode<'hole'> {
}

export const buildHole = (node: ParseNode): Hole => {
    return { type: 'hole', parseNode: node }
}

export interface MatchExpr extends AstNode<'match-expr'> {
    expr: Expr
    clauses: MatchClause
}

export const buildMatchExpr = (node: ParseNode): MatchExpr => {
    return todo()
}

export interface MatchClause extends AstNode<'match-clause'> {
    pattern: Pattern
    block: Block
    guard?: Expr
}
