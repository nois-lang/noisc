import { LexerToken } from '../lexer/lexer'
import { ParseNode, ParseTree, filterNonAstNodes } from '../parser'
import { nameLikeTokens } from '../parser/fns'
import { Context, Definition } from '../scope'
import { assert } from '../util/todo'
import { Expr, buildExpr } from './expr'
import { BaseAstNode, Param, buildParam } from './index'
import { MatchExpr, Pattern, buildMatchExpr, buildNumber, buildPattern } from './match'
import { Block, TraitDef, buildBlock } from './statement'
import { Type, TypeParam, buildType, buildTypeParam } from './type'

export type Operand =
    | FnDef
    | WhileExpr
    | ForExpr
    | MatchExpr
    | ListExpr
    | StringLiteral
    | StringInterpolated
    | CharLiteral
    | IntLiteral
    | FloatLiteral
    | BoolLiteral
    | Identifier
    | Block

export type FnDef = BaseAstNode & {
    kind: 'fn-def'
    typeParams: TypeParam[]
    params: Param[]
    block?: Block
    returnType?: Type
    static?: boolean
    trait?: TraitDef
}

export const buildFnDef = (node: ParseNode, ctx: Context): FnDef => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    // skip fn-keyword
    idx++
    const typeParams =
        nodes.at(idx)?.kind === 'type-params' ? filterNonAstNodes(nodes[idx++]).map(n => buildTypeParam(n, ctx)) : []
    const params = nodes.at(idx)?.kind === 'params' ? filterNonAstNodes(nodes[idx++]).map(n => buildParam(n, ctx)) : []
    const returnType = nodes.at(idx)?.kind === 'type-annot' ? buildType(nodes[idx++], ctx) : undefined
    const block = nodes.at(idx)?.kind === 'block' ? buildBlock(nodes[idx++], ctx) : undefined
    return { kind: 'fn-def', parseNode: node, typeParams, params, block, returnType }
}

export const buildOperand = (node: ParseNode, ctx: Context): Operand => {
    const n = filterNonAstNodes(node)[0]
    switch (n.kind) {
        case 'fn-def':
            return buildFnDef(n, ctx)
        case 'while-expr':
            return buildWhileExpr(n, ctx)
        case 'for-expr':
            return buildForExpr(n, ctx)
        case 'match-expr':
            return buildMatchExpr(n, ctx)
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
        case 'block':
            return buildBlock(n, ctx)
    }
    throw Error(`expected operand, got ${node.kind}`)
}

export const identifierFromOperand = (operand: Operand): Identifier | undefined => {
    if (operand.kind === 'identifier') return operand
    return undefined
}

export type WhileExpr = BaseAstNode & {
    kind: 'while-expr'
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

export type ForExpr = BaseAstNode & {
    kind: 'for-expr'
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

export type ListExpr = BaseAstNode & {
    kind: 'list-expr'
    exprs: Expr[]
}

export const buildListExpr = (node: ParseNode, ctx: Context): ListExpr => {
    const nodes = filterNonAstNodes(node)
    const exprs = nodes.length > 0 ? nodes.filter(n => n.kind === 'expr').map(n => buildExpr(n, ctx)) : []
    return { kind: 'list-expr', parseNode: node, exprs }
}

export type StringLiteral = BaseAstNode & {
    kind: 'string-literal'
    value: string
}

export type StringInterpolated = BaseAstNode & {
    kind: 'string-interpolated'
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

export type CharLiteral = BaseAstNode & {
    kind: 'char-literal'
    value: string
}

export const buildChar = (node: ParseNode, ctx: Context): CharLiteral => {
    return { kind: 'char-literal', parseNode: node, value: (<LexerToken>node).value }
}

export type IntLiteral = BaseAstNode & {
    kind: 'int-literal'
    value: string
}

export type FloatLiteral = BaseAstNode & {
    kind: 'float-literal'
    value: string
}

export type BoolLiteral = BaseAstNode & {
    kind: 'bool-literal'
    value: string
}

export const buildBool = (node: ParseNode, ctx: Context): BoolLiteral => {
    return { kind: 'bool-literal', parseNode: node, value: (<LexerToken>node).value }
}

export type Identifier = BaseAstNode & {
    kind: 'identifier'
    names: Name[]
    typeArgs: Type[]
    def?: Definition
}

export const buildIdentifier = (node: ParseNode, ctx: Context): Identifier => {
    const names = (<ParseTree>node).nodes
        .filter(n => nameLikeTokens.includes((<LexerToken>n).kind))
        .map(n => buildName(n, ctx))
    const typeArgsNode = filterNonAstNodes(node).find(n => n.kind === 'type-args')
    const typeArgs = typeArgsNode ? filterNonAstNodes(typeArgsNode).map(n => buildType(n, ctx)) : []
    return { kind: 'identifier', parseNode: node, names, typeArgs: typeArgs }
}

export type Name = BaseAstNode & {
    kind: 'name'
    value: string
    def?: Definition
}

export const buildName = (node: ParseNode, ctx: Context): Name => {
    return { kind: 'name', parseNode: node, value: (<LexerToken>node).value }
}
