import { AstNode, buildParam, buildType, filterNonAstNodes, Param, Type, TypeParam } from './index'
import { buildTypeDef, TypeDef } from './type-def'
import { buildExpr, Expr } from './expr'
import { buildPattern, Pattern } from './match'
import { ParseNode, ParseTree } from '../parser/parser'
import { buildName, Identifier, Name } from './operand'

export type Statement = UseExpr | VarDef | FnDef | KindDef | ImplDef | TypeDef | ReturnStmt | Expr

export const buildStatement = (node: ParseNode): Statement => {
    const n = (<ParseTree>node).nodes[0]
    switch (n.kind) {
        case 'use-stmt':
            return buildUseExpr(n)
        case 'var-def':
            return buildVarDef(n)
        case 'fn-def':
            return buildFnDef(n)
        case 'kind-def':
            return buildKindDef(n)
        case 'impl-def':
            return buildImplDef(n)
        case 'type-def':
            return buildTypeDef(n)
        case 'return-stmt':
            return buildReturnStmt(n)
        case 'expr':
            return buildExpr(n)
    }
    throw Error(`expected statement, got ${node.kind}`)
}

export interface UseExpr extends AstNode<'use-expr'> {
    scope: Name[]
    expr: UseExpr[] | Name | Wildcard
}

export const buildUseExpr = (node: ParseNode): UseExpr => {
    const nodes = filterNonAstNodes(node.kind === 'use-stmt' ? filterNonAstNodes(node)[0] : node)
    const names = nodes.filter(n => n.kind === 'name').map(buildName)
    if (nodes.at(-1)!.kind === 'wildcard') {
        const scope = names
        return { type: 'use-expr', parseNode: node, scope, expr: { type: 'wildcard', parseNode: nodes.at(-1)! } }
    }
    if (nodes.at(-1)!.kind === 'use-list') {
        const scope = names
        return { type: 'use-expr', parseNode: node, scope, expr: filterNonAstNodes(nodes.at(-1)!).map(buildUseExpr) }
    }
    return { type: 'use-expr', parseNode: node, scope: names.slice(0, -1), expr: names.at(-1)! }
}

export interface Wildcard extends AstNode<'wildcard'> {}

export interface VarDef extends AstNode<'var-def'> {
    pattern: Pattern
    varType?: Type
    expr: Expr
}

export const buildVarDef = (node: ParseNode): VarDef => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    const pattern = buildPattern(nodes[idx++])
    const varType = nodes[idx].kind === 'type-annot' ? buildType(filterNonAstNodes(nodes[idx++])[0]) : undefined
    const expr = buildExpr(nodes[idx++])
    return { type: 'var-def', parseNode: node, pattern, varType, expr }
}

export interface FnDef extends AstNode<'fn-def'> {
    type: 'fn-def'
    identifier: Identifier
    typeParams: TypeParam[]
    params: Param[]
    block?: Block
    returnType?: Type
}

export const buildFnDef = (node: ParseNode): FnDef => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    const { identifier, typeParams } = buildType(nodes[idx++])
    const params = nodes.at(idx)?.kind === 'params' ? filterNonAstNodes(nodes[idx++]).map(buildParam) : []
    const returnType = nodes.at(idx)?.kind === 'type-annot' ? buildType(nodes[idx++]) : undefined
    const block = nodes.at(idx)?.kind === 'block' ? buildBlock(nodes[idx++]) : undefined
    return { type: 'fn-def', parseNode: node, identifier, typeParams, params, block, returnType }
}

export interface KindDef extends AstNode<'kind-def'> {
    identifier: Identifier
    kindParams: TypeParam[]
    block: Block
}

export const buildKindDef = (node: ParseNode): KindDef => {
    const nodes = filterNonAstNodes(node)
    const { identifier, typeParams: kindParams } = buildType(nodes[0])
    const block = buildBlock(nodes[1])
    return { type: 'kind-def', parseNode: node, identifier, kindParams, block }
}

export interface ImplDef extends AstNode<'impl-def'> {
    identifier: Identifier
    implParams: TypeParam[]
    forKind?: Type
    block: Block
}

export const buildImplDef = (node: ParseNode): ImplDef => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    const { identifier, typeParams: implParams } = buildType(nodes[idx++])
    const forKind = nodes.at(idx)?.kind === 'impl-for' ? buildType(filterNonAstNodes(nodes[idx++])[0]) : undefined
    const block = buildBlock(nodes[idx++])
    return { type: 'impl-def', parseNode: node, identifier, implParams, forKind, block }
}

export interface ReturnStmt extends AstNode<'return-stmt'> {
    returnExpr?: Expr
}

export const buildReturnStmt = (node: ParseNode): ReturnStmt => {
    const nodes = filterNonAstNodes(node)
    const returnExpr = nodes.at(0)?.kind === 'expr' ? buildExpr(nodes[0]) : undefined
    return { type: 'return-stmt', parseNode: node, returnExpr }
}

export interface Block extends AstNode<'block'> {
    statements: Statement[]
}

export const buildBlock = (node: ParseNode): Block => {
    const statements = filterNonAstNodes(node).map(buildStatement)
    return { type: 'block', parseNode: node, statements }
}
