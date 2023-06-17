import { buildMatchExpr, buildPattern, MatchExpr, Pattern } from './match'
import { AstNode, buildParam, buildType, filterNonAstNodes, Param, Type, Typed } from './index'
import { Block, buildBlock } from './statement'
import { buildExpr, Expr } from './expr'
import { ParseToken } from '../lexer/lexer'
import { ParseNode } from '../parser'

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

export interface IfExpr extends AstNode<'if-expr'>, Partial<Typed> {
    condition: Expr
    thenBlock: Block
    elseBlock?: Block
}

export const buildIfExpr = (node: ParseNode): IfExpr => {
    const nodes = filterNonAstNodes(node)
    const condition = buildExpr(nodes[0])
    const thenBlock = buildBlock(nodes[1])
    const elseBlock = nodes.at(2) ? buildBlock(nodes[1]) : undefined
    return { kind: 'if-expr', parseNode: node, condition, thenBlock, elseBlock }
}

export interface WhileExpr extends AstNode<'while-expr'>, Partial<Typed> {
    condition: Expr
    block: Block
}

export const buildWhileExpr = (node: ParseNode): WhileExpr => {
    const nodes = filterNonAstNodes(node)
    const condition = buildExpr(nodes[0])
    const block = buildBlock(nodes[1])
    return { kind: 'while-expr', parseNode: node, condition, block }
}

export interface ForExpr extends AstNode<'for-expr'>, Partial<Typed> {
    pattern: Pattern
    expr: Expr
    block: Block
}

export const buildForExpr = (node: ParseNode): ForExpr => {
    const nodes = filterNonAstNodes(node)
    const pattern = buildPattern(nodes[0])
    const expr = buildExpr(nodes[1])
    const block = buildBlock(nodes[2])
    return { kind: 'for-expr', parseNode: node, pattern, expr, block }
}

export interface ClosureExpr extends AstNode<'closure-expr'>, Partial<Typed> {
    params: Param[]
    block: Block
    returnType?: Type
}

export const buildClosureExpr = (node: ParseNode): ClosureExpr => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    const params = filterNonAstNodes(nodes[idx++]).filter(n => n.kind === 'param').map(n => buildParam(n))
    const block = nodes[idx].kind === 'expr' ? <Block>{ statements: [buildExpr(nodes[idx++])] } : buildBlock(nodes[idx++])
    const returnType = nodes.at(idx) ? buildType(nodes[idx++]) : undefined
    return { kind: 'closure-expr', parseNode: node, params, block, returnType }
}

export interface ListExpr extends AstNode<'list-expr'>, Partial<Typed> {
    exprs: Expr[]
}

export const buildListExpr = (node: ParseNode): ListExpr => {
    const nodes = filterNonAstNodes(node)
    const exprs = filterNonAstNodes(nodes[0]).filter(n => n.kind === 'expr').map(n => buildExpr(n))
    return { kind: 'list-expr', parseNode: node, exprs }
}

export interface StringLiteral extends AstNode<'string-literal'>, Partial<Typed> {
    value: string
}

export const buildStringLiteral = (node: ParseNode): StringLiteral => {
    return { kind: 'string-literal', parseNode: node, value: (<ParseToken>node).value }
}

export interface CharLiteral extends AstNode<'char-literal'>, Partial<Typed> {
    value: string
}

export const buildCharLiteral = (node: ParseNode): CharLiteral => {
    return { kind: 'char-literal', parseNode: node, value: (<ParseToken>node).value }
}

export interface IntLiteral extends AstNode<'int-literal'>, Partial<Typed> {
    value: string
}

export const buildIntLiteral = (node: ParseNode): IntLiteral => {
    return { kind: 'int-literal', parseNode: node, value: (<ParseToken>node).value }
}

export interface FloatLiteral extends AstNode<'float-literal'>, Partial<Typed> {
    value: string
}

export const buildFloatLiteral = (node: ParseNode): FloatLiteral => {
    return { kind: 'float-literal', parseNode: node, value: (<ParseToken>node).value }
}

export interface Identifier extends AstNode<'identifier'>, Partial<Typed> {
    scope: Name[]
    name: Name
}

export const buildIdentifier = (node: ParseNode): Identifier => {
    const names = filterNonAstNodes(node).map(buildName)
    const scope = names.slice(0, -1)
    const name = names.at(-1)!
    return { kind: 'identifier', parseNode: node, scope, name }
}

export interface Name extends AstNode<'name'> {
    value: string
}

export const buildName = (node: ParseNode): Name => {
    return { kind: 'name', parseNode: node, value: (<ParseToken>node).value }
}
