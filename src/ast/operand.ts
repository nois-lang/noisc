import { MatchExpr, Pattern } from './match'
import { AstNode, Param, Type } from './index'
import { Block } from './statement'
import { Expr } from './expr'
import { ParseNode } from '../parser/parser'
import { todo } from '../todo'

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

export interface IfExpr extends AstNode<'if-expr'> {
    condition: Expr
    thenBlock: Block
    elseBlock?: Block
}

export interface WhileExpr extends AstNode<'while-expr'> {
    condition: Expr
    block: Block
}

export interface ForExpr extends AstNode<'for-expr'> {
    pattern: Pattern
    expr: Expr
    block: Block
}

export interface ClosureExpr extends AstNode<'closure-expr'> {
    name: Identifier
    typeParams: Type[]
    params: Param[]
    block: Block
    returnType?: Type
}

export interface ListExpr extends AstNode<'list-expr'> {
    exprs: Expr[]
}

export interface StringLiteral extends AstNode<'string-literal'> {
    value: string
}

export interface CharLiteral extends AstNode<'char-literal'> {
    value: string
}

export interface IntLiteral extends AstNode<'int-literal'> {
    value: string
}

export interface FloatLiteral extends AstNode<'float-literal'> {
    value: string
}

export interface Identifier extends AstNode<'identifier'> {
    value: string
}

export const buildIdentifier = (node: ParseNode): Identifier => {
    return todo()
}
