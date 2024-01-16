import { lexerDynamicKinds } from '../lexer/lexer'
import { NodeKind, ParseNode, ParseTree, treeKinds } from '../parser'
import { nameLikeTokens } from '../parser/fns'
import { Scope } from '../scope'
import { VirtualIdentifier } from '../scope/vid'
import { Typed } from '../semantic'
import { Source } from '../source'
import { Expr, buildExpr } from './expr'
import { Pattern, buildPattern } from './match'
import { Name, buildName } from './operand'
import { Block, UseExpr, buildStatement, buildUseExpr } from './statement'
import { Type, buildType } from './type'

export interface AstNode<T extends AstNodeKind> {
    kind: T
    parseNode: ParseNode
}

export type AstNodeKind =
    | 'module'
    | 'use-expr'
    | 'wildcard'
    | 'var-def'
    | 'fn-def'
    | 'trait-def'
    | 'impl-def'
    | 'type-def'
    | 'field-def'
    | 'variant'
    | 'return-stmt'
    | 'break-stmt'
    | 'operand-expr'
    | 'unary-expr'
    | 'binary-expr'
    | 'field-init'
    | 'block'
    | 'closure-expr'
    | 'list-expr'
    | 'param'
    | 'type-bounds'
    | 'fn-type'
    | 'generic'
    | 'if-expr'
    | 'if-let-expr'
    | 'while-expr'
    | 'for-expr'
    | 'match-expr'
    | 'match-clause'
    | 'pattern'
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

export const astNodes: NodeKind[] = [...lexerDynamicKinds, ...nameLikeTokens, ...treeKinds]

export const filterNonAstNodes = (node: ParseNode): ParseNode[] =>
    (<ParseTree>node).nodes.filter(n => astNodes.includes(n.kind))

export const compactAstNode = (node: AstNode<any>): any => {
    if (typeof node !== 'object') return node
    return Object.fromEntries(
        Object.entries(node)
            .filter(([p]) => p !== 'parseNode')
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

export interface Module extends AstNode<'module'> {
    source: Source
    identifier: VirtualIdentifier
    block: Block

    scopeStack: Scope[]
    useExprs: UseExpr[]

    /**
     * All vids accessible from the current module, based on {@link useExprs}
     */
    references?: VirtualIdentifier[]
    /**
     * Persistent top level scope.
     * Different from scopeStack[0] because it is always available
     * If module is accessed during its check, use scopeStack.at(0) instead
     */
    topScope?: Scope
}

export const buildModuleAst = (node: ParseNode, id: VirtualIdentifier, source: Source): Module => {
    const useExprs = filterNonAstNodes(node)
        .filter(n => n.kind === 'use-stmt')
        .map(buildUseExpr)
    const statements = filterNonAstNodes(node)
        .filter(n => n.kind === 'statement')
        .map(buildStatement)
    const block: Block = { kind: 'block', parseNode: node, statements }
    return {
        kind: 'module',
        parseNode: node,
        source,
        identifier: id,
        block,
        scopeStack: [],
        useExprs
    }
}

export interface Param extends AstNode<'param'>, Partial<Typed> {
    pattern: Pattern
    paramType?: Type
}

export const buildParam = (node: ParseNode): Param => {
    const nodes = filterNonAstNodes(node)
    const pattern = buildPattern(nodes[0])
    const typeNode = nodes.at(1)
    return { kind: 'param', parseNode: node, pattern, paramType: typeNode ? buildType(typeNode) : undefined }
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
