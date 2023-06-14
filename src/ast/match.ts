import { Expr } from './expr'
import { Block } from './statement'
import { AstNode } from './index'
import { ParseNode } from '../parser/parser'
import { todo } from '../todo'

export type Pattern = ConPattern | Expr | Hole

export const buildPattern = (node: ParseNode): Pattern => {
    return todo()
}

export interface ConPattern extends AstNode<'con-pattern'> {
    // TODO
}

export interface Hole extends AstNode<'hole'> {
}

export interface MatchExpr extends AstNode<'match-expr'> {
    expr: Expr
    clauses: MatchClause
}

export interface MatchClause extends AstNode<'match-clause'> {
    pattern: Pattern
    block: Block
    guard?: Expr
}
