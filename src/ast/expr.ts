import { BinaryOp, UnaryOp } from './op'
import { Identifier, Param, Type } from './ast'
import { Block } from './statement'
import { MatchExpr, Pattern } from './match'

export type Expr = UnaryExpr | BinaryExpr

export interface UnaryExpr {
    type: 'unary-expr'
    unaryOp: UnaryOp
    operand: Operand
}

export interface BinaryExpr {
    type: 'binary-expr'
    binaryOp: BinaryOp
    lOperand: Operand
    rOperand: Operand
}

export type Operand =
    IfExpr
    | WhileExpr
    | ForExpr
    | MatchExpr
    | ClosureExpr
    | Expr
    | ListExpr
    | StringLiteral
    | CharLiteral
    | IntLiteral
    | FloatLiteral
    | Identifier

export interface IfExpr {
    type: 'if-expr'
    condition: Expr
    thenBlock: Block
    elseBlock?: Block
}

export interface WhileExpr {
    type: 'while-expr'
    condition: Expr
    block: Block
}

export interface ForExpr {
    type: 'for-expr'
    pattern: Pattern
    expr: Expr
    block: Block
}

export interface ClosureExpr {
    type: 'closure-expr'
    name: Identifier
    typeParams: Type[]
    params: Param[]
    block: Block
    returnType?: Type
}

export interface ListExpr {
    type: 'list-expr'
    exprs: Expr[]
}

export interface StringLiteral {
    type: 'string-literal'
    value: string
}

export interface CharLiteral {
    type: 'char-literal'
    value: string
}

export interface IntLiteral {
    type: 'int-literal'
    value: string
}

export interface FloatLiteral {
    type: 'float-literal'
    value: string
}
