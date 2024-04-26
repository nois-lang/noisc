import { LexerToken } from '../lexer/lexer'
import { ParseNode, ParseTree, filterNonAstNodes } from '../parser'
import { nameLikeTokens } from '../parser/fns'
import { Context } from '../scope'
import { VirtualIdentifierMatch } from '../scope/vid'
import { Static, Typed, Virtual } from '../semantic'
import { assert } from '../util/todo'
import { Expr, buildExpr } from './expr'
import { AstNode, Param, buildParam } from './index'
import { MatchExpr, Pattern, buildMatchExpr, buildNumber, buildPattern } from './match'
import { Block, buildBlock, buildStatement } from './statement'
import { Type, buildType } from './type'

export type Operand = (
    | IfExpr
    | IfLetExpr
    | WhileExpr
    | ForExpr
    | MatchExpr
    | ClosureExpr
    | Expr
    | ListExpr
    | StringLiteral
    | StringInterpolated
    | CharLiteral
    | IntLiteral
    | FloatLiteral
    | BoolLiteral
    | Identifier
) &
    Partial<Virtual>

export const buildOperand = (node: ParseNode, ctx: Context): Operand => {
    const n = filterNonAstNodes(node)[0]
    switch (n.kind) {
        case 'if-expr':
            return buildIfExpr(n, ctx)
        case 'if-let-expr':
            return buildIfLetExpr(n, ctx)
        case 'while-expr':
            return buildWhileExpr(n, ctx)
        case 'for-expr':
            return buildForExpr(n, ctx)
        case 'match-expr':
            return buildMatchExpr(n, ctx)
        case 'closure-expr':
            return buildClosureExpr(n, ctx)
        case 'expr':
            return buildExpr(n, ctx)
        case 'list-expr':
            return buildListExpr(n, ctx)
        case 'string':
            return buildString(n, ctx)
        case 'char':
            return buildChar(n, ctx)
        case 'number':
            return buildNumber(n, ctx)
        case 'bool':
            return buildBool(n, ctx)
        case 'identifier':
            return buildIdentifier(n, ctx)
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

export const buildIfExpr = (node: ParseNode, ctx: Context): IfExpr => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    // skip if-keyword
    idx++
    const condition = buildExpr(nodes[idx++], ctx)
    const thenBlock = buildBlock(nodes[idx++], ctx)
    // skip else keyword
    idx++
    const elseBlock = nodes.at(idx) ? buildBlock(nodes[idx++], ctx) : undefined
    return { kind: 'if-expr', parseNode: node, condition, thenBlock, elseBlock }
}

export interface IfLetExpr extends AstNode<'if-let-expr'>, Partial<Typed> {
    pattern: Pattern
    expr: Expr
    thenBlock: Block
    elseBlock?: Block
}

export const buildIfLetExpr = (node: ParseNode, ctx: Context): IfLetExpr => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    // skip if and let keywords
    idx++
    idx++
    const pattern = buildPattern(nodes[idx++], ctx)
    const expr = buildExpr(nodes[idx++], ctx)
    const thenBlock = buildBlock(nodes[idx++], ctx)
    // skip else keyword
    idx++
    const elseBlock = nodes.at(idx) ? buildBlock(nodes[idx++], ctx) : undefined
    return { kind: 'if-let-expr', parseNode: node, pattern, expr, thenBlock, elseBlock }
}

export interface WhileExpr extends AstNode<'while-expr'>, Partial<Typed> {
    condition: Expr
    block: Block
}

export const buildWhileExpr = (node: ParseNode, ctx: Context): WhileExpr => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    // skip while-keyword
    idx++
    const condition = buildExpr(nodes[idx++], ctx)
    const block = buildBlock(nodes[idx++], ctx)
    return { kind: 'while-expr', parseNode: node, condition, block }
}

export interface ForExpr extends AstNode<'for-expr'>, Partial<Typed> {
    pattern: Pattern
    expr: Expr
    block: Block
}

export const buildForExpr = (node: ParseNode, ctx: Context): ForExpr => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    // skip for-keyword
    idx++
    const pattern = buildPattern(nodes[idx++], ctx)
    // skip in-keyword
    idx++
    const expr = buildExpr(nodes[idx++], ctx)
    const block = buildBlock(nodes[idx++], ctx)
    return { kind: 'for-expr', parseNode: node, pattern, expr, block }
}

export interface ClosureExpr extends AstNode<'closure-expr'>, Partial<Typed> {
    params: Param[]
    block: Block
    returnType?: Type
}

export const buildClosureExpr = (node: ParseNode, ctx: Context): ClosureExpr => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    const params = filterNonAstNodes(nodes[idx++])
        .filter(n => n.kind === 'param')
        .map(n => buildParam(n, ctx))
    const returnType = nodes.at(idx)?.kind === 'type-annot' ? buildType(nodes[idx++], ctx) : undefined
    const block: Block =
        nodes[idx].kind === 'block'
            ? buildBlock(nodes[idx++], ctx)
            : { kind: 'block', parseNode: nodes[idx], statements: [buildStatement(nodes[idx++], ctx)] }
    return { kind: 'closure-expr', parseNode: node, params, block, returnType }
}

export interface ListExpr extends AstNode<'list-expr'>, Partial<Typed> {
    exprs: Expr[]
}

export const buildListExpr = (node: ParseNode, ctx: Context): ListExpr => {
    const nodes = filterNonAstNodes(node)
    const exprs = nodes.length > 0 ? nodes.filter(n => n.kind === 'expr').map(n => buildExpr(n, ctx)) : []
    return { kind: 'list-expr', parseNode: node, exprs }
}

export interface StringLiteral extends AstNode<'string-literal'>, Partial<Typed> {
    value: string
}

export interface StringInterpolated extends AstNode<'string-interpolated'>, Partial<Typed> {
    tokens: (string | Expr)[]
}

export const buildString = (node: ParseNode, ctx: Context): StringLiteral | StringInterpolated => {
    assert(node.kind === 'string')
    const nodes = filterNonAstNodes(node)
    const tokens = nodes.map(n => buildStringPart(n, ctx))
    if (tokens.length === 0) {
        return { kind: 'string-literal', parseNode: node, value: '""' }
    }
    if (tokens.length === 1 && typeof tokens[0] === 'string') {
        return { kind: 'string-literal', parseNode: node, value: `"${tokens[0]}"` }
    }
    return { kind: 'string-interpolated', parseNode: node, tokens }
}

export const buildStringPart = (node: ParseNode, ctx: Context): string | Expr => {
    const n = filterNonAstNodes(node)[0]
    if (n.kind === 'string-part') {
        return (<LexerToken>n).value
    } else {
        return buildExpr(n, ctx)
    }
}

export interface CharLiteral extends AstNode<'char-literal'>, Partial<Typed> {
    value: string
}

export const buildChar = (node: ParseNode, ctx: Context): CharLiteral => {
    return { kind: 'char-literal', parseNode: node, value: (<LexerToken>node).value }
}

export interface IntLiteral extends AstNode<'int-literal'>, Partial<Typed> {
    value: string
}

export interface FloatLiteral extends AstNode<'float-literal'>, Partial<Typed> {
    value: string
}

export interface BoolLiteral extends AstNode<'bool-literal'>, Partial<Typed> {
    value: string
}

export const buildBool = (node: ParseNode, ctx: Context): BoolLiteral => {
    return { kind: 'bool-literal', parseNode: node, value: (<LexerToken>node).value }
}

export interface Identifier extends AstNode<'identifier'>, Partial<Typed>, Partial<Static> {
    names: Name[]
    typeArgs: Type[]
    ref?: VirtualIdentifierMatch
}

export const buildIdentifier = (node: ParseNode, ctx: Context): Identifier => {
    const names = (<ParseTree>node).nodes
        .filter(n => nameLikeTokens.includes((<LexerToken>n).kind))
        .map(n => buildName(n, ctx))
    const typeArgsNode = filterNonAstNodes(node).find(n => n.kind === 'type-args')
    const typeArgs = typeArgsNode ? filterNonAstNodes(typeArgsNode).map(n => buildType(n, ctx)) : []
    return { kind: 'identifier', parseNode: node, names, typeArgs: typeArgs }
}

export interface Name extends AstNode<'name'>, Partial<Typed> {
    value: string
}

export const buildName = (node: ParseNode, ctx: Context): Name => {
    return { kind: 'name', parseNode: node, value: (<LexerToken>node).value }
}
