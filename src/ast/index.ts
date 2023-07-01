import { Block, buildStatement, buildUseExpr, UseExpr } from './statement'
import { buildPattern, Pattern } from './match'
import { NodeKind, ParseNode, ParseTree, treeKinds } from '../parser'
import { lexerDynamicKinds, ParseToken } from '../lexer/lexer'
import { buildName, Name } from './operand'
import { buildExpr, Expr } from './expr'
import { VirtualIdentifier } from '../scope'
import { LocationRange } from '../location'
import { buildType, Type } from './type'

export interface AstNode<T extends AstNodeKind> {
    kind: T
    parseNode: ParseNode
}

export type AstNodeKind
    = 'module'
    | 'use-expr'
    | 'wildcard'
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
    | 'variant-type'
    | 'fn-type'
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

    | 'neg-op'
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

export const astNodes: NodeKind[] = [...lexerDynamicKinds, ...treeKinds]

export const filterNonAstNodes = (node: ParseNode): ParseNode[] =>
    (<ParseTree>node).nodes.filter(n => astNodes.includes(n.kind))

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

export const getAstLocationRange = (node: AstNode<any>): LocationRange => {
    const leftmostNode = (node: ParseNode): ParseToken => {
        if ('nodes' in node) {
            return leftmostNode(node.nodes[0])
        } else {
            return node
        }
    }
    const rightmostNode = (node: ParseNode): ParseToken => {
        if ('nodes' in node) {
            return rightmostNode(node.nodes.at(-1)!)
        } else {
            return node
        }
    }
    return { start: leftmostNode(node.parseNode).location.start, end: rightmostNode(node.parseNode).location.end }
}

export interface Module extends AstNode<'module'> {
    identifier: VirtualIdentifier
    useExprs: UseExpr[]
    block: Block
}

export const buildModuleAst = (node: ParseNode, id: VirtualIdentifier): Module => {
    const useExprs = filterNonAstNodes(node).filter(n => n.kind === 'use-stmt').map(buildUseExpr)
    const statements = filterNonAstNodes(node).filter(n => n.kind === 'statement').map(buildStatement)
    const block: Block = { kind: 'block', parseNode: node, statements }
    return { kind: 'module', identifier: id, parseNode: node, useExprs, block }
}

export interface Param extends AstNode<'param'> {
    pattern: Pattern
    paramType?: Type
}

export const buildParam = (node: ParseNode): Param => {
    const nodes = filterNonAstNodes(node)
    const pattern = buildPattern(nodes[0])
    const typeNode = nodes.at(1)
    return { kind: 'param', parseNode: node, pattern, paramType: typeNode ? buildType(typeNode) : undefined, }
}

export interface FieldInit extends AstNode<'field-init'> {
    name: Name
    expr: Expr
}

export const buildFieldInit = (node: ParseNode): FieldInit => {
    const nodes = filterNonAstNodes(node)
    const name = buildName(nodes[0])
    const expr = buildExpr(nodes[1])
    return { kind: 'field-init', parseNode: node, name, expr }
}

