import { BinaryOp, UnaryOp } from './op'
import { AstNode } from './index'
import { VarDef } from './statement'
import { ParseNode } from '../parser/parser'
import { todo } from '../todo'
import { Operand } from './operand'

export type Expr = UnaryExpr | BinaryExpr

export const buildExpr = (node: ParseNode): VarDef => {
    return todo()
}

export interface UnaryExpr extends AstNode<'unary-expr'> {
    unaryOp: UnaryOp
    operand: Operand
}

export interface BinaryExpr extends AstNode<'binary-expr'> {
    binaryOp: BinaryOp
    lOperand: Operand
    rOperand: Operand
}
