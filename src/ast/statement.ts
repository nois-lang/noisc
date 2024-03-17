import { ParseNode, filterNonAstNodes } from '../parser'
import { InstanceRelation } from '../scope/trait'
import { MethodDef } from '../scope/vid'
import { Checked, Typed } from '../semantic'
import { assert } from '../util/todo'
import { Expr, buildExpr } from './expr'
import { AstNode, Param, buildParam } from './index'
import { Pattern, buildPattern } from './match'
import { Identifier, Name, buildIdentifier, buildName } from './operand'
import { Generic, Type, buildGeneric, buildType } from './type'
import { TypeDef, buildTypeDef } from './type-def'

export type Statement = VarDef | FnDef | TraitDef | ImplDef | TypeDef | ReturnStmt | BreakStmt | Expr

export const buildStatement = (node: ParseNode): Statement => {
    const n = filterNonAstNodes(node)[0]
    switch (n.kind) {
        case 'var-def':
            return buildVarDef(n)
        case 'fn-def':
            return buildFnDef(n)
        case 'trait-def':
            return buildTraitDef(n)
        case 'impl-def':
            return buildImplDef(n)
        case 'type-def':
            return buildTypeDef(n)
        case 'return-stmt':
            return buildReturnStmt(n)
        case 'break-stmt':
            return buildBreakStmt(n)
        case 'expr':
            return buildExpr(n)
    }
    throw Error(`expected statement, got ${node.kind}`)
}

export interface UseExpr extends AstNode<'use-expr'> {
    scope: Name[]
    expr: UseExpr[] | Name
    pub: boolean
}

export const buildUseExpr = (node: ParseNode): UseExpr => {
    const nodes = filterNonAstNodes(node)
    let i = 0
    const pub = nodes[i].kind === 'pub-keyword'
    if (pub) i++
    // skip use keyword
    if (nodes[i].kind === 'use-keyword') i++
    if (nodes[i].kind === 'use-expr') {
        const expr = buildUseExpr(nodes[i])
        expr.pub = pub
        return expr
    }
    const names = nodes
        .slice(i)
        .filter(n => n.kind === 'name')
        .map(buildName)
    const lastNode = nodes.at(-1)!
    if (lastNode.kind === 'use-list') {
        const scope = names
        return { kind: 'use-expr', parseNode: node, scope, expr: filterNonAstNodes(lastNode).map(buildUseExpr), pub }
    }
    return { kind: 'use-expr', parseNode: node, scope: names.slice(0, -1), expr: names.at(-1)!, pub }
}

export interface VarDef extends AstNode<'var-def'>, Partial<Checked> {
    pattern: Pattern
    varType?: Type
    expr?: Expr
    pub: boolean
}

export const buildVarDef = (node: ParseNode): VarDef => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    const pub = nodes[idx].kind === 'pub-keyword'
    if (pub) idx++
    // skip let-keyword
    idx++
    const pattern = buildPattern(nodes[idx++])
    const varType = nodes.at(idx)?.kind === 'type-annot' ? buildType(filterNonAstNodes(nodes[idx++])[0]) : undefined
    const expr = nodes.at(idx)?.kind === 'expr' ? buildExpr(nodes[idx++]) : undefined
    return { kind: 'var-def', parseNode: node, pattern, varType, expr, pub }
}

export interface FnDef extends AstNode<'fn-def'>, Partial<Typed>, Partial<Checked> {
    kind: 'fn-def'
    name: Name
    generics: Generic[]
    params: Param[]
    block?: Block
    returnType?: Type
    static?: boolean
    pub: boolean
}

export const buildFnDef = (node: ParseNode): FnDef => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    const pub = nodes[idx].kind === 'pub-keyword'
    if (pub) idx++
    // skip fn-keyword
    idx++
    const name = buildName(nodes[idx++])
    const generics = nodes.at(idx)?.kind === 'generics' ? filterNonAstNodes(nodes[idx++]).map(buildGeneric) : []
    const params = nodes.at(idx)?.kind === 'params' ? filterNonAstNodes(nodes[idx++]).map(buildParam) : []
    const returnType = nodes.at(idx)?.kind === 'type-annot' ? buildType(nodes[idx++]) : undefined
    const block = nodes.at(idx)?.kind === 'block' ? buildBlock(nodes[idx++]) : undefined
    return { kind: 'fn-def', parseNode: node, name, generics, params, block, returnType, pub }
}

export interface TraitDef extends AstNode<'trait-def'> {
    name: Name
    generics: Generic[]
    block: Block
    pub: boolean
}

export const buildTraitDef = (node: ParseNode): TraitDef => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    const pub = nodes[idx].kind === 'pub-keyword'
    if (pub) idx++
    // skip trait-keyword
    idx++
    const name = buildName(nodes[idx++])
    const generics = nodes.at(idx)?.kind === 'generics' ? filterNonAstNodes(nodes[idx++]).map(buildGeneric) : []
    const block = buildBlock(nodes[idx++])
    return { kind: 'trait-def', parseNode: node, name, generics, block, pub }
}

export interface ImplDef extends AstNode<'impl-def'>, Partial<Checked> {
    identifier: Identifier
    generics: Generic[]
    forTrait?: Identifier
    block: Block
    superMethods?: MethodDef[]
    rel?: InstanceRelation
}

export const buildImplDef = (node: ParseNode): ImplDef => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    // skip impl-keyword
    idx++
    const generics = nodes.at(idx)?.kind === 'generics' ? filterNonAstNodes(nodes[idx++]).map(buildGeneric) : []
    const identifier = buildIdentifier(nodes[idx++])
    const forTrait =
        nodes.at(idx)?.kind === 'impl-for' ? buildIdentifier(filterNonAstNodes(nodes[idx++])[1]) : undefined
    const block = buildBlock(nodes[idx++])
    return { kind: 'impl-def', parseNode: node, identifier, generics, forTrait, block }
}

export interface ReturnStmt extends AstNode<'return-stmt'>, Partial<Typed> {
    returnExpr: Expr
}

export const buildReturnStmt = (node: ParseNode): ReturnStmt => {
    const nodes = filterNonAstNodes(node)
    assert(nodes[0].kind === 'return-keyword')
    const returnExpr = buildExpr(nodes[1])
    return { kind: 'return-stmt', parseNode: node, returnExpr }
}

export interface BreakStmt extends AstNode<'break-stmt'> {}

export const buildBreakStmt = (node: ParseNode): BreakStmt => {
    return { kind: 'break-stmt', parseNode: node }
}

export interface Block extends AstNode<'block'>, Partial<Typed> {
    statements: Statement[]
}

export const buildBlock = (node: ParseNode): Block => {
    const statements = filterNonAstNodes(node).map(buildStatement)
    return { kind: 'block', parseNode: node, statements }
}
