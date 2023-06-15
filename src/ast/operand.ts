import { buildMatchExpr, buildPattern, MatchExpr, Pattern } from './match'
import { AstNode, buildParam, buildType, filterNonAstNodes, Param, Type } from './index'
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
    const n = filterNonAstNodes(node)[0]
    switch (n.kind) {
        case 'if-expr':
            return buildIfExpr(n)
        case 'while-expr':
            return buildWhileExpr(n)
        case 'for-expr':
            return buildForExpr(n)
        case 'match-expr':
            return buildMatchExpr(n)
        case 'closure-expr':
            return buildClosureExpr(n)
        case 'expr':
            return buildExpr(n)
        case 'list-expr':
            return buildListExpr(n)
        case 'string':
            return buildStringLiteral(n)
        case 'char':
            return buildCharLiteral(n)
        case 'int':
            return buildIntLiteral(n)
        case 'float':
            return buildFloatLiteral(n)
        case 'identifier':
            return buildIdentifier(n)
    }
    throw Error(`expected operand, got ${node.kind}`)
}

export interface IfExpr extends AstNode<'if-expr'> {
    condition: Expr
    thenBlock: Block
    elseBlock?: Block
}

export const buildIfExpr = (node: ParseNode): IfExpr => {
    const nodes = filterNonAstNodes(node)
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
    const nodes = filterNonAstNodes(node)
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
    const nodes = filterNonAstNodes(node)
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
    const nodes = filterNonAstNodes(node)
    const identifier = buildIdentifier(nodes[0])
    const typeParams = filterNonAstNodes(nodes[1]).filter(n => n.kind === 'type-expr').map(n => buildType(n))
    const params = filterNonAstNodes(nodes[2]).filter(n => n.kind === 'param').map(n => buildParam(n))
    const block = buildBlock(nodes[3])
    const returnType = nodes.at(4) ? buildType(nodes[4]) : undefined
    return { type: 'closure-expr', parseNode: node, identifier, typeParams, params, block, returnType }
}

export interface ListExpr extends AstNode<'list-expr'> {
    exprs: Expr[]
}

export const buildListExpr = (node: ParseNode): ListExpr => {
    const nodes = filterNonAstNodes(node)
    const exprs = filterNonAstNodes(nodes[0]).filter(n => n.kind === 'expr').map(n => buildExpr(n))
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
