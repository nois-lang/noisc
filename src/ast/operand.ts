import { LexerToken } from '../lexer/lexer'
import { ParseNode, ParseTree, filterNonAstNodes } from '../parser'
import { nameLikeTokens } from '../parser/fns'
import { VirtualIdentifierMatch } from '../scope/vid'
import { Typed } from '../semantic'
import { Expr, buildExpr } from './expr'
import { AstNode, Param, buildParam } from './index'
import { MatchExpr, Pattern, buildMatchExpr, buildNumber, buildPattern } from './match'
import { Block, buildBlock } from './statement'
import { Type, buildType } from './type'

export type Operand =
    | IfExpr
    | IfLetExpr
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
    | BoolLiteral
    | Identifier

export const buildOperand = (node: ParseNode): Operand => {
    const n = filterNonAstNodes(node)[0]
    switch (n.kind) {
        case 'if-expr':
            return buildIfExpr(n)
        case 'if-let-expr':
            return buildIfLetExpr(n)
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
        case 'number':
            return buildNumber(n)
        case 'bool':
            return buildBoolLiteral(n)
        case 'identifier':
            return buildIdentifier(n)
    }
    throw Error(`expected operand, got ${node.kind}`)
}

export const identifierFromOperand = (operand: Operand): Identifier | undefined => {
    if (operand.kind === 'identifier') return operand
    if (operand.kind === 'operand-expr') {
        return identifierFromOperand(operand.operand)
    }
    return undefined
}

export interface IfExpr extends AstNode<'if-expr'>, Partial<Typed> {
    condition: Expr
    thenBlock: Block
    elseBlock?: Block
}

export const buildIfExpr = (node: ParseNode): IfExpr => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    // skip if-keyword
    idx++
    const condition = buildExpr(nodes[idx++])
    const thenBlock = buildBlock(nodes[idx++])
    // skip else keyword
    idx++
    const elseBlock = nodes.at(idx) ? buildBlock(nodes[idx++]) : undefined
    return { kind: 'if-expr', parseNode: node, condition, thenBlock, elseBlock }
}

export interface IfLetExpr extends AstNode<'if-let-expr'>, Partial<Typed> {
    pattern: Pattern
    expr: Expr
    thenBlock: Block
    elseBlock?: Block
}

export const buildIfLetExpr = (node: ParseNode): IfLetExpr => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    // skip if and let keywords
    idx++
    idx++
    const pattern = buildPattern(nodes[idx++])
    const expr = buildExpr(nodes[idx++])
    const thenBlock = buildBlock(nodes[idx++])
    // skip else keyword
    idx++
    const elseBlock = nodes.at(idx) ? buildBlock(nodes[idx++]) : undefined
    return { kind: 'if-let-expr', parseNode: node, pattern, expr, thenBlock, elseBlock }
}

export interface WhileExpr extends AstNode<'while-expr'>, Partial<Typed> {
    condition: Expr
    block: Block
}

export const buildWhileExpr = (node: ParseNode): WhileExpr => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    // skip while-keyword
    idx++
    const condition = buildExpr(nodes[idx++])
    const block = buildBlock(nodes[idx++])
    return { kind: 'while-expr', parseNode: node, condition, block }
}

export interface ForExpr extends AstNode<'for-expr'>, Partial<Typed> {
    pattern: Pattern
    expr: Expr
    block: Block
}

export const buildForExpr = (node: ParseNode): ForExpr => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    // skip for-keyword
    idx++
    const pattern = buildPattern(nodes[idx++])
    // skip in-keyword
    idx++
    const expr = buildExpr(nodes[idx++])
    const block = buildBlock(nodes[idx++])
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
    const params = filterNonAstNodes(nodes[idx++])
        .filter(n => n.kind === 'param')
        .map(n => buildParam(n))
    const returnType = nodes.at(idx)?.kind === 'type-annot' ? buildType(nodes[idx++]) : undefined
    const block = buildBlock(nodes[idx++])
    return { kind: 'closure-expr', parseNode: node, params, block, returnType }
}

export interface ListExpr extends AstNode<'list-expr'>, Partial<Typed> {
    exprs: Expr[]
}

export const buildListExpr = (node: ParseNode): ListExpr => {
    const nodes = filterNonAstNodes(node)
    const exprs = nodes.length > 0 ? nodes.filter(n => n.kind === 'expr').map(n => buildExpr(n)) : []
    return { kind: 'list-expr', parseNode: node, exprs }
}

export interface StringLiteral extends AstNode<'string-literal'>, Partial<Typed> {
    value: string
}

export const buildStringLiteral = (node: ParseNode): StringLiteral => {
    return { kind: 'string-literal', parseNode: node, value: (<LexerToken>node).value }
}

export interface CharLiteral extends AstNode<'char-literal'>, Partial<Typed> {
    value: string
}

export const buildCharLiteral = (node: ParseNode): CharLiteral => {
    return { kind: 'char-literal', parseNode: node, value: (<LexerToken>node).value }
}

export interface IntLiteral extends AstNode<'int-literal'>, Partial<Typed> {
    value: string
}

export const buildIntLiteral = (node: ParseNode): IntLiteral => {
    return { kind: 'int-literal', parseNode: node, value: (<LexerToken>node).value }
}

export interface FloatLiteral extends AstNode<'float-literal'>, Partial<Typed> {
    value: string
}

export const buildFloatLiteral = (node: ParseNode): FloatLiteral => {
    return { kind: 'float-literal', parseNode: node, value: (<LexerToken>node).value }
}

export interface BoolLiteral extends AstNode<'bool-literal'>, Partial<Typed> {
    value: string
}

export const buildBoolLiteral = (node: ParseNode): BoolLiteral => {
    return { kind: 'bool-literal', parseNode: node, value: (<LexerToken>node).value }
}

export interface Identifier extends AstNode<'identifier'>, Partial<Typed> {
    names: Name[]
    typeArgs: Type[]
    ref?: VirtualIdentifierMatch
}

export const buildIdentifier = (node: ParseNode): Identifier => {
    const names = (<ParseTree>node).nodes.filter(n => nameLikeTokens.includes((<LexerToken>n).kind)).map(buildName)
    const typeArgsNode = filterNonAstNodes(node).find(n => n.kind === 'type-args')
    const typeArgs = typeArgsNode ? filterNonAstNodes(typeArgsNode).map(buildType) : []
    return { kind: 'identifier', parseNode: node, names, typeArgs: typeArgs }
}

export interface Name extends AstNode<'name'>, Partial<Typed> {
    value: string
}

export const buildName = (node: ParseNode): Name => {
    return { kind: 'name', parseNode: node, value: (<LexerToken>node).value }
}
