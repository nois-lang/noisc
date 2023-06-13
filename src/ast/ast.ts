import { Statement } from './statement'
import { Pattern } from './match'

export type AstNodeKind =
    'module'
    | 'var-def'
    | 'fn-def'
    | 'kind-def'
    | 'impl-def'
    | 'type-def'
    | 'return-stmt'
    | 'unary-expr'
    | 'binary-expr'

export interface Module {
    type: 'module'
    statements: Statement[]
}

export interface Type {
    type: 'type'
    name: Identifier
    typeParams: Type[]
}

export type Identifier = string

export interface Param {
    type: 'param'
    pattern: Pattern
    paramType?: Type
}

