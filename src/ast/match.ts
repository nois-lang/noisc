import { Expr } from './expr'
import { Block } from './statement'

export type Pattern = ConPattern | Expr | Hole

export interface ConPattern {
    type: 'con-pattern'
    // TODO
}

export interface Hole {
    type: 'hole'
}

export interface MatchExpr {
    type: 'match-expr'
    expr: Expr
    clauses: MatchClause
}

export interface MatchClause {
    type: 'match-clause'
    pattern: Pattern
    block: Block
    guard?: Expr
}
