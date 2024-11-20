import { ParseNode, filterNonAstNodes } from '../parser'
import { Context } from '../scope'
import { assert } from '../util/todo'
import { Expr, buildExpr } from './expr'
import { BaseAstNode } from './index'
import { Pattern, buildPattern } from './match'
import { Identifier, Name, buildIdentifier, buildName } from './operand'
import { Type, TypeParam, buildType, buildTypeParam } from './type'
import { TypeDef, buildTypeDef } from './type-def'

export type Statement = VarDef | TraitDef | ImplDef | TypeDef | ReturnStmt | BreakStmt | Expr

export const buildStatement = (node: ParseNode, ctx: Context): Statement => {
    const n = filterNonAstNodes(node)[0]
    switch (n.kind) {
        case 'var-def':
            return buildVarDef(n, ctx)
        case 'trait-def':
            return buildTraitDef(n, ctx)
        case 'impl-def':
            return buildImplDef(n, ctx)
        case 'type-def':
            return buildTypeDef(n, ctx)
        case 'return-stmt':
            return buildReturnStmt(n, ctx)
        case 'break-stmt':
            return buildBreakStmt(n, ctx)
        case 'expr':
            return buildExpr(n, ctx)
    }
    throw Error(`expected statement, got ${node.kind}`)
}

export type UseExpr = BaseAstNode & {
    kind: 'use-expr'
    scope: Name[]
    expr: UseExpr[] | Name
    pub: boolean
}

export const buildUseExpr = (node: ParseNode, ctx: Context): UseExpr => {
    const nodes = filterNonAstNodes(node)
    let i = 0
    const pub = nodes[i].kind === 'pub-keyword'
    if (pub) i++
    // skip use keyword
    if (nodes[i].kind === 'use-keyword') i++
    if (nodes[i].kind === 'use-expr') {
        const expr = buildUseExpr(nodes[i], ctx)
        expr.pub = pub
        return expr
    }
    const names = nodes
        .slice(i)
        .filter(n => n.kind === 'name')
        .map(n => buildName(n, ctx))
    const lastNode = nodes.at(-1)!
    if (lastNode.kind === 'use-list') {
        const scope = names
        return {
            kind: 'use-expr',
            parseNode: node,
            scope,
            expr: filterNonAstNodes(lastNode).map(n => buildUseExpr(n, ctx)),
            pub
        }
    }
    return { kind: 'use-expr', parseNode: node, scope: names.slice(0, -1), expr: names.at(-1)!, pub }
}

export type VarDef = BaseAstNode & {
    kind: 'var-def'
    pattern: Pattern
    varType?: Type
    expr?: Expr
    pub: boolean
}

export const buildVarDef = (node: ParseNode, ctx: Context): VarDef => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    const pub = nodes[idx].kind === 'pub-keyword'
    if (pub) idx++
    // skip let-keyword
    idx++
    const pattern = buildPattern(nodes[idx++], ctx)
    const varType =
        nodes.at(idx)?.kind === 'type-annot' ? buildType(filterNonAstNodes(nodes[idx++])[0], ctx) : undefined
    const expr = nodes.at(idx)?.kind === 'expr' ? buildExpr(nodes[idx++], ctx) : undefined
    return { kind: 'var-def', parseNode: node, pattern, varType, expr, pub }
}

export type TraitDef = BaseAstNode & {
    kind: 'trait-def'
    name: Name
    typeParams: TypeParam[]
    block: TraitBlock
    pub: boolean
}

export const buildTraitDef = (node: ParseNode, ctx: Context): TraitDef => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    const pub = nodes[idx].kind === 'pub-keyword'
    if (pub) idx++
    // skip trait-keyword
    idx++
    const name = buildName(nodes[idx++], ctx)
    const typeParams =
        nodes.at(idx)?.kind === 'type-params' ? filterNonAstNodes(nodes[idx++]).map(n => buildTypeParam(n, ctx)) : []
    const block = buildTraitBlock(nodes[idx++], ctx)
    return { kind: 'trait-def', parseNode: node, name, typeParams, block, pub }
}

export type TraitBlock = BaseAstNode & {
    kind: 'trait-block'
    statements: TraitStatement[]
}

export const buildTraitBlock = (node: ParseNode, ctx: Context): TraitBlock => {
    const statements = filterNonAstNodes(node).map(n => buildTraitStatement(n, ctx))
    return { kind: 'trait-block', parseNode: node, statements }
}

export type TraitStatement = BaseAstNode & {
    kind: 'trait-statement'
    name: Name
    expr: Expr
}

export const buildTraitStatement = (node: ParseNode, ctx: Context): TraitStatement => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    const name = buildName(nodes[idx++], ctx)
    const expr = buildExpr(nodes[idx++], ctx)
    return { kind: 'trait-statement', parseNode: node, name, expr }
}

export type ImplDef = BaseAstNode & {
    kind: 'impl-def'
    identifier: Identifier
    typeParams: TypeParam[]
    forTrait?: Identifier
    block: TraitBlock
}

export const buildImplDef = (node: ParseNode, ctx: Context): ImplDef => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    // skip impl-keyword
    idx++
    const typeParams =
        nodes.at(idx)?.kind === 'type-params' ? filterNonAstNodes(nodes[idx++]).map(n => buildTypeParam(n, ctx)) : []
    const identifier = buildIdentifier(nodes[idx++], ctx)
    const forTrait =
        nodes.at(idx)?.kind === 'impl-for' ? buildIdentifier(filterNonAstNodes(nodes[idx++])[1], ctx) : undefined
    const block = buildTraitBlock(nodes[idx++], ctx)
    return { kind: 'impl-def', parseNode: node, identifier, typeParams, forTrait, block }
}

export type ReturnStmt = BaseAstNode & {
    kind: 'return-stmt'
    returnExpr: Expr
}

export const buildReturnStmt = (node: ParseNode, ctx: Context): ReturnStmt => {
    const nodes = filterNonAstNodes(node)
    assert(nodes[0].kind === 'return-keyword')
    const returnExpr = buildExpr(nodes[1], ctx)
    return { kind: 'return-stmt', parseNode: node, returnExpr }
}

export type BreakStmt = BaseAstNode & {
    kind: 'break-stmt'
}

export const buildBreakStmt = (node: ParseNode, ctx: Context): BreakStmt => {
    return { kind: 'break-stmt', parseNode: node }
}

export type Block = BaseAstNode & {
    kind: 'block'
    statements: Statement[]
}

export const buildBlock = (node: ParseNode, ctx: Context): Block => {
    const statements = filterNonAstNodes(node).map(n => buildStatement(n, ctx))
    return { kind: 'block', parseNode: node, statements }
}
