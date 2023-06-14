import { AstNode, Param, Type } from './index'
import { ParseNode } from '../parser/parser'
import { VarDef } from './statement'
import { todo } from '../todo'
import { Identifier } from './operand'

export interface TypeDef extends AstNode<'type-def'> {
    name: Identifier
    typeParams: Param[]
    variants: TypeCon[]
}

export const buildTypeDef = (node: ParseNode): VarDef => {
    return todo()
}

export interface TypeCon extends AstNode<'type-con'> {
    fieldDefs: FieldDef[]
}

export interface FieldDef extends AstNode<'field-def'> {
    name: Identifier
    fieldType: Type
}

