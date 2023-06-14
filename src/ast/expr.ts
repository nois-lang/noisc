import { BinaryOp, UnaryOp } from './op'
import { AstNode } from './index'
import { ParseNode } from '../parser/parser'
import { todo } from '../todo'
import { Operand } from './operand'

export type Expr = OperandExpr | UnaryExpr | BinaryExpr

export const buildExpr = (node: ParseNode): Expr => {
    return todo()
}

export interface OperandExpr extends AstNode<'operand-expr'> {
    operand: Operand
}

export const buildOperandExpr = (node: ParseNode): OperandExpr => {
    return todo()
}

export interface UnaryExpr extends AstNode<'unary-expr'> {
    unaryOp: UnaryOp
    operand: Operand
}

export const buildUnaryExpr = (node: ParseNode): UnaryExpr => {
    return todo()
}

export interface BinaryExpr extends AstNode<'binary-expr'> {
    binaryOp: BinaryOp
    lOperand: Operand
    rOperand: Operand
}

export const buildBinaryExpr = (node: ParseNode): BinaryExpr => {
    return todo()
}
