import { buildStatement, Statement } from './statement'
import { buildPattern, Pattern } from './match'
import { ParseNode, ParseTree, treeKinds } from '../parser/parser'
import { lexerDynamicKinds } from '../lexer/lexer'
import { buildIdentifier, buildName, Identifier, Name } from './operand'
import { buildExpr, Expr } from './expr'

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
    | 'operand-expr'
    | 'unary-expr'
    | 'binary-expr'
    | 'field-init'
    | 'block'
    | 'closure-expr'
    | 'list-expr'
    | 'param'
    | 'type'
    | 'generic'
    | 'if-expr'
    | 'while-expr'
    | 'for-expr'
    | 'match-expr'
    | 'match-clause'
    | 'con-pattern'
    | 'field-pattern'
    | 'hole'
    | 'identifier'
    | 'name'
    | 'string-literal'
    | 'char-literal'
    | 'int-literal'
    | 'float-literal'

    | 'not-op'
    | 'spread-op'
    | 'call-op'
    | 'con-op'

    | 'add-op'
    | 'sub-op'
    | 'mult-op'
    | 'div-op'
    | 'exp-op'
    | 'mod-op'
    | 'access-op'
    | 'eq-op'
    | 'ne-op'
    | 'ge-op'
    | 'le-op'
    | 'gt-op'
    | 'lt-op'
    | 'and-op'
    | 'or-op'
    | 'assign-op'

export const astNodes = [...lexerDynamicKinds, ...treeKinds]

export const filterNonAstNodes = (node: ParseNode): ParseNode[] =>
    (<ParseTree>node).nodes.filter(n => astNodes.includes(n.kind))

export interface Module extends AstNode<'module'> {
    statements: Statement[]
}

export const buildModule = (node: ParseNode): Module => {
    return {
        type: 'module',
        parseNode: node,
        statements: filterNonAstNodes(node).filter(n => n.kind === 'statement').map(n => buildStatement(n))
    }
}

export interface Type extends AstNode<'type'> {
    identifier: Identifier
    typeParams: TypeParam[]
}

export type TypeParam = Type | Generic

export interface Generic extends AstNode<'generic'> {
    name: Name
    bounds: Type[]
}

export const buildType = (node: ParseNode): Type => {
    const nodes = filterNonAstNodes(node)
    if (node.kind === 'type-annot') {
        return buildType(nodes[0])
    }
    const nameNode = nodes[0]
    const paramsNode = nodes.at(1)
    return {
        type: 'type',
        parseNode: node,
        identifier: buildIdentifier(nameNode),
        typeParams: paramsNode
            ? (<ParseTree>paramsNode).nodes
                .filter(n => n.kind === 'type-param')
                .map(buildTypeParam)
            : [],
    }
}

export const buildTypeParam = (node: ParseNode): TypeParam => {
    const nodes = filterNonAstNodes(node)
    if (nodes[0].kind === 'type-expr') {
        return buildType(nodes[0])
    } else {
        const name = buildName(nodes[0])
        const bounds = filterNonAstNodes(nodes[1]).map(buildType)
        return { type: 'generic', parseNode: node, name, bounds }
    }
}

export interface Param extends AstNode<'param'> {
    pattern: Pattern
    paramType?: Type
}

export const buildParam = (node: ParseNode): Param => {
    const nodes = filterNonAstNodes(node)
    const pattern = buildPattern(nodes[0])
    const typeNode = nodes.at(1)
    return { type: 'param', parseNode: node, pattern, paramType: typeNode ? buildType(typeNode) : undefined, }
}

export interface FieldInit extends AstNode<'field-init'> {
    name: Name
    expr: Expr
}

export const buildFieldInit = (node: ParseNode): FieldInit => {
    const nodes = filterNonAstNodes(node)
    const name = buildName(nodes[0])
    const expr = buildExpr(nodes[1])
    return { type: 'field-init', parseNode: node, name, expr }
}

export const compactAstNode = (node: AstNode<any>): any => {
    if (typeof node !== 'object') return node
    return Object.fromEntries(
        Object.entries(node)
            .filter(([p,]) => p !== 'parseNode')
            .map(([p, v]) => {
                if (Array.isArray(v)) {
                    return [p, v.map(compactAstNode)]
                }
                if (typeof v === 'object' && 'parseNode' in v) {
                    return [p, compactAstNode(v)]
                }
                return [p, v]
            })
    )
}

