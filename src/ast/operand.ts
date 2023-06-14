import { buildMatchExpr, buildPattern, MatchExpr, Pattern } from './match'
import { AstNode, buildParam, buildType, filterIndependent, Param, Type } from './index'
import { Block, buildBlock } from './statement'
import { buildExpr, Expr } from './expr'
import { ParseNode } from '../parser/parser'
import { ParseToken } from '../lexer/lexer'

export type Operand
    = IfExpr
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

export const buildOperand = (node: ParseNode): Operand => {
    const t = filterIndependent(node)[0]
    switch (t.kind) {
        case 'if-expr':
            return buildIfExpr(t)
        case 'while-expr':
            return buildWhileExpr(t)
        case 'for-expr':
            return buildForExpr(t)
        case 'match-expr':
            return buildMatchExpr(t)
        case 'closure-expr':
            return buildClosureExpr(t)
        case 'expr':
            return buildExpr(t)
        case 'list-expr':
            return buildListExpr(t)
        case 'string':
            return buildStringLiteral(t)
        case 'char':
            return buildCharLiteral(t)
        case 'int':
            return buildIntLiteral(t)
        case 'float':
            return buildFloatLiteral(t)
        case 'identifier':
            return buildIdentifier(t)
    }
    throw Error('expected operand')
}

export interface IfExpr extends AstNode<'if-expr'> {
    condition: Expr
    thenBlock: Block
    elseBlock?: Block
}

export const buildIfExpr = (node: ParseNode): IfExpr => {
    const nodes = filterIndependent(node)
    const condition = buildExpr(nodes[0])
    const thenBlock = buildBlock(nodes[1])
    const elseBlock = nodes.at(2) ? buildBlock(nodes[1]) : undefined
    return { type: 'if-expr', parseNode: node, condition, thenBlock, elseBlock }
}

export interface WhileExpr extends AstNode<'while-expr'> {
    condition: Expr
    block: Block
}

export const buildWhileExpr = (node: ParseNode): WhileExpr => {
    const nodes = filterIndependent(node)
    const condition = buildExpr(nodes[0])
    const block = buildBlock(nodes[1])
    return { type: 'while-expr', parseNode: node, condition, block }
}

export interface ForExpr extends AstNode<'for-expr'> {
    pattern: Pattern
    expr: Expr
    block: Block
}

export const buildForExpr = (node: ParseNode): ForExpr => {
    const nodes = filterIndependent(node)
    const pattern = buildPattern(nodes[0])
    const expr = buildExpr(nodes[1])
    const block = buildBlock(nodes[2])
    return { type: 'for-expr', parseNode: node, pattern, expr, block }
}

export interface ClosureExpr extends AstNode<'closure-expr'> {
    identifier: Identifier
    typeParams: Type[]
    params: Param[]
    block: Block
    returnType?: Type
}

export const buildClosureExpr = (node: ParseNode): ClosureExpr => {
    const nodes = filterIndependent(node)
    const identifier = buildIdentifier(nodes[0])
    const typeParams = filterIndependent(nodes[1]).filter(n => n.kind === 'type-expr').map(n => buildType(n))
    const params = filterIndependent(nodes[2]).filter(n => n.kind === 'param').map(n => buildParam(n))
    const block = buildBlock(nodes[3])
    const returnType = nodes.at(4) ? buildType(nodes[4]) : undefined
    return { type: 'closure-expr', parseNode: node, identifier, typeParams, params, block, returnType }
}

export interface ListExpr extends AstNode<'list-expr'> {
    exprs: Expr[]
}

export const buildListExpr = (node: ParseNode): ListExpr => {
    const nodes = filterIndependent(node)
    const exprs = filterIndependent(nodes[0]).filter(n => n.kind === 'expr').map(n => buildExpr(n))
    return { type: 'list-expr', parseNode: node, exprs }
}

export interface StringLiteral extends AstNode<'string-literal'> {
    value: string
}

export const buildStringLiteral = (node: ParseNode): StringLiteral => {
    return { type: 'string-literal', parseNode: node, value: (<ParseToken>node).value }
}

export interface CharLiteral extends AstNode<'char-literal'> {
    value: string
}

export const buildCharLiteral = (node: ParseNode): CharLiteral => {
    return { type: 'char-literal', parseNode: node, value: (<ParseToken>node).value }
}

export interface IntLiteral extends AstNode<'int-literal'> {
    value: string
}

export const buildIntLiteral = (node: ParseNode): IntLiteral => {
    return { type: 'int-literal', parseNode: node, value: (<ParseToken>node).value }
}

export interface FloatLiteral extends AstNode<'float-literal'> {
    value: string
}

export const buildFloatLiteral = (node: ParseNode): FloatLiteral => {
    return { type: 'float-literal', parseNode: node, value: (<ParseToken>node).value }
}

export interface Identifier extends AstNode<'identifier'> {
    value: string
}

export const buildIdentifier = (node: ParseNode): Identifier => {
    return { type: 'identifier', parseNode: node, value: (<ParseToken>node).value }
}
