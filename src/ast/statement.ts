import { Identifier, Param, Type } from './ast'
import { TypeDef } from './type-def'
import { Expr } from './expr'
import { Pattern } from './match'

export type Statement = VarDef | FnDef | KindDef | ImplDef | TypeDef | ReturnStmt | Expr

export interface VarDef {
    type: 'var-def'
    pattern: Pattern
    varType: Type
    expr: Expr
}

export interface FnDef {
    type: 'fn-def'
    name: Identifier
    typeParams: Type[]
    params: Param[]
    block?: Block
    returnType?: Type
}

export interface KindDef {
    type: 'kind-def'
    name: Identifier
    kindParams: Type[]
    block: Block
}

export interface ImplDef {
    type: 'impl-def'
    name: Identifier
    implParams: Type[]
    forKind?: Type
    block: Block
}

export interface ReturnStmt {
    type: 'return-stmt'
}

export interface Block {
    type: 'block'
    statements: Statement[]
}
