import { AstNode, Param, Type } from './index'
import { buildTypeDef, TypeDef } from './type-def'
import { buildExpr, Expr } from './expr'
import { Pattern } from './match'
import { ParseNode, ParseTree } from '../parser/parser'
import { todo } from '../todo'
import { Identifier } from './operand'

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

export interface VarDef extends AstNode<'var-def'> {
    pattern: Pattern
    varType: Type
    expr: Expr
}

export const buildVarDef = (node: ParseNode): VarDef => {
    return todo()
}

export interface FnDef extends AstNode<'fn-def'> {
    type: 'fn-def'
    identifier: Identifier
    typeParams: Type[]
    params: Param[]
    block?: Block
    returnType?: Type
}

export const buildFnDef = (node: ParseNode): VarDef => {
    return todo()
}

export interface KindDef extends AstNode<'kind-def'> {
    identifier: Identifier
    kindParams: Type[]
    block: Block
}

export const buildKindDef = (node: ParseNode): VarDef => {
    return todo()
}

export interface ImplDef extends AstNode<'impl-def'> {
    identifier: Identifier
    implParams: Type[]
    forKind?: Type
    block: Block
}

export const buildImplDef = (node: ParseNode): VarDef => {
    return todo()
}

export interface ReturnStmt extends AstNode<'return-stmt'> {
    returnExpr?: Expr
}

export const buildReturnStmt = (node: ParseNode): VarDef => {
    return todo()
}

export interface Block extends AstNode<'block'> {
    statements: Statement[]
}

export const buildBlock = (node: ParseNode): Block => {
    return todo()
}
