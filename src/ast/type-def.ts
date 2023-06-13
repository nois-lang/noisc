import { Identifier, Param, Type } from './ast'

export interface TypeDef {
    type: 'type-def'
    name: Identifier
    typeParams: Param[]
    variants: TypeCon[]
}

export interface TypeCon {
    type: 'type-con'
    fieldDefs: FieldDef[]
}

export interface FieldDef {
    type: 'field-def'
    name: Identifier
    fieldType: Type
}

