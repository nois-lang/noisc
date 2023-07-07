import { AstNode, buildParam, filterNonAstNodes, Param } from './index'
import { buildTypeDef, TypeDef } from './type-def'
import { buildExpr, Expr } from './expr'
import { buildPattern, Pattern } from './match'
import { buildName, Name } from './operand'
import { ParseNode, ParseTree } from '../parser'
import { Typed } from '../typecheck'
import { buildGeneric, buildType, Generic, Type } from './type'

export type Statement = VarDef | FnDef | KindDef | ImplDef | TypeDef | ReturnStmt | Expr

export const buildStatement = (node: ParseNode): Statement => {
    const n = (<ParseTree>node).nodes[0]
    switch (n.kind) {
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
        return { kind: 'use-expr', parseNode: node, scope, expr: { kind: 'wildcard', parseNode: nodes.at(-1)! } }
    }
    if (nodes.at(-1)!.kind === 'use-list') {
        const scope = names
        return { kind: 'use-expr', parseNode: node, scope, expr: filterNonAstNodes(nodes.at(-1)!).map(buildUseExpr) }
    }
    return { kind: 'use-expr', parseNode: node, scope: names.slice(0, -1), expr: names.at(-1)! }
}

export interface Wildcard extends AstNode<'wildcard'> {}

export interface VarDef extends AstNode<'var-def'>, Partial<Typed> {
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
    return { kind: 'var-def', parseNode: node, pattern, varType, expr }
}

export interface FnDef extends AstNode<'fn-def'>, Partial<Typed> {
    kind: 'fn-def'
    name: Name
    generics: Generic[]
    params: Param[]
    block?: Block
    returnType?: Type
}

export const buildFnDef = (node: ParseNode): FnDef => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    const name = buildName(nodes[idx++])
    const generics = nodes.at(idx)?.kind === 'generics' ? filterNonAstNodes(nodes[idx++]).map(buildGeneric) : []
    const params = nodes.at(idx)?.kind === 'params' ? filterNonAstNodes(nodes[idx++]).map(buildParam) : []
    const returnType = nodes.at(idx)?.kind === 'type-annot' ? buildType(nodes[idx++]) : undefined
    const block = nodes.at(idx)?.kind === 'block' ? buildBlock(nodes[idx++]) : undefined
    return { kind: 'fn-def', parseNode: node, name, generics, params, block, returnType }
}

export interface KindDef extends AstNode<'kind-def'> {
    name: Name
    generics: Generic[]
    block: Block
}

export const buildKindDef = (node: ParseNode): KindDef => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    const name = buildName(nodes[idx++])
    const generics = nodes.at(idx)?.kind === 'generics' ? filterNonAstNodes(nodes[idx++]).map(buildGeneric) : []
    const block = buildBlock(nodes[idx++])
    return { kind: 'kind-def', parseNode: node, name, generics, block }
}

export interface ImplDef extends AstNode<'impl-def'> {
    name: Name
    generics: Generic[]
    forKind?: Type
    block: Block
}

export const buildImplDef = (node: ParseNode): ImplDef => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    const name = buildName(nodes[idx++])
    const generics = nodes.at(idx)?.kind === 'generics' ? filterNonAstNodes(nodes[idx++]).map(buildGeneric) : []
    const forKind = nodes.at(idx)?.kind === 'impl-for' ? buildType(nodes[idx++]) : undefined
    const block = buildBlock(nodes[idx++])
    return { kind: 'impl-def', parseNode: node, name, generics, forKind, block }
}

export interface ReturnStmt extends AstNode<'return-stmt'>, Partial<Typed> {
    returnExpr?: Expr
}

export const buildReturnStmt = (node: ParseNode): ReturnStmt => {
    const nodes = filterNonAstNodes(node)
    const returnExpr = nodes.at(0)?.kind === 'expr' ? buildExpr(nodes[0]) : undefined
    return { kind: 'return-stmt', parseNode: node, returnExpr }
}

export interface Block extends AstNode<'block'>, Partial<Typed> {
    statements: Statement[]
}

export const buildBlock = (node: ParseNode): Block => {
    const statements = filterNonAstNodes(node).map(buildStatement)
    return { kind: 'block', parseNode: node, statements }
}
