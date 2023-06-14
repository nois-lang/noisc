import { buildStatement, Statement } from './statement'
import { buildPattern, Pattern } from './match'
import { ParseNode, ParseTree } from '../parser/parser'
import { independentTokenKinds } from '../lexer/lexer'
import { buildIdentifier, Identifier } from './operand'

export interface AstNode<T extends AstNodeKind> {
    type: T
    parseNode: ParseNode
}

export type AstNodeKind
    = 'module'
    | 'var-def'
    | 'fn-def'
    | 'kind-def'
    | 'impl-def'
    | 'type-def'
    | 'field-def'
    | 'type-con'
    | 'return-stmt'
    | 'unary-expr'
    | 'binary-expr'
    | 'block'
    | 'closure-expr'
    | 'list-expr'
    | 'param'
    | 'type'
    | 'if-expr'
    | 'while-expr'
    | 'for-expr'
    | 'match-expr'
    | 'match-clause'
    | 'con-pattern'
    | 'hole'
    | 'identifier'
    | 'string-literal'
    | 'char-literal'
    | 'int-literal'
    | 'float-literal'

export const filterIndependent = (node: ParseNode): ParseNode[] =>
    (<ParseTree>node).nodes.filter(n => !independentTokenKinds.includes(n.kind))

export interface Module extends AstNode<'module'> {
    statements: Statement[]
}

export const buildModule = (node: ParseNode): Module => {
    return {
        type: 'module',
        parseNode: node,
        statements: filterIndependent(node).filter(n => n.kind === 'statement').map(n => buildStatement(n))
    }
}

export interface Type extends AstNode<'type'> {
    name: Identifier
    typeParams: Type[]
}

export const buildType = (node: ParseNode): Type => {
    const nodes = filterIndependent(node)
    const nameNode = nodes[0]
    const paramsNode = nodes.at(1)
    return {
        type: 'type',
        parseNode: node,
        name: buildIdentifier(nameNode),
        typeParams: paramsNode
            ? (<ParseTree>paramsNode).nodes
                .filter(n => n.kind === 'type-params')
                .map(n => buildType((<ParseTree>n).nodes[0]))
            : [],
    }
}

export interface Param extends AstNode<'param'> {
    pattern: Pattern
    paramType?: Type
}

export const buildParam = (node: ParseNode): Param => {
    const nodes = filterIndependent(node)
    const paramNode = nodes[0]
    const typeNode = nodes.at(1)
    return {
        type: 'param',
        parseNode: node,
        pattern: buildPattern(paramNode),
        paramType: typeNode ? buildType(typeNode) : undefined,
    }
}
