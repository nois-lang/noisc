import { AstNode } from './index'
import { ParseNode } from '../parser/parser'
import { todo } from '../todo'

export type UnaryOp = 'todo'

export const buildUnaryOp = (node: ParseNode): UnaryOp => {
    return todo()
}

export type BinaryOp = 'todo'

export const buildBinaryOp = (node: ParseNode): BinaryOp => {
    return todo()
}

export interface SpreadOp extends AstNode<'spread-op'> {
}
