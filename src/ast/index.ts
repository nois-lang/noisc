import { ParseNode, filterNonAstNodes } from '../parser'
import { Scope } from '../scope'
import { InstanceRelation } from '../scope/trait'
import { VirtualIdentifier, VirtualIdentifierMatch } from '../scope/vid'
import { Typed } from '../semantic'
import { VirtualUseExpr } from '../semantic/use-expr'
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

export const astExprKinds = <const>[
    'operand-expr',
    'unary-expr',
    'binary-expr',
    'closure-expr',
    'list-expr',
    'if-let-expr',
    'while-expr',
    'for-expr',
    'match-expr'
]

export const astDefKinds = <const>['var-def', 'fn-def', 'trait-def', 'impl-def', 'type-def', 'field-def']

export const astLiteralKinds = <const>['string-literal', 'char-literal', 'int-literal', 'float-literal', 'bool-literal']

export const astInfixOpKinds = <const>[
    'add-op',
    'sub-op',
    'mult-op',
    'div-op',
    'exp-op',
    'mod-op',
    'eq-op',
    'ne-op',
    'ge-op',
    'le-op',
    'gt-op',
    'lt-op',
    'and-op',
    'or-op',
    'assign-op'
]

export const astPostfixOpKinds = <const>[
    'method-call-op',
    'field-access-op',
    'call-op',
    'unwrap-op',
    'bind-op',
    'await-op'
]

export const astKinds = <const>[
    'module',
    'use-expr',
    'variant',
    'return-stmt',
    'break-stmt',
    'call',
    'arg',
    'block',
    'param',
    'type-bounds',
    'fn-type',
    'generic',
    'if-expr',
    'match-clause',
    'pattern',
    'con-pattern',
    'field-pattern',
    'hole',
    'identifier',
    'name',
    'string-interpolated',
    ...astExprKinds,
    ...astDefKinds,
    ...astLiteralKinds,
    ...astInfixOpKinds,
    ...astPostfixOpKinds
]

export type AstNodeKind = (typeof astKinds)[number]

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
    mod: boolean
    block: Block

    scopeStack: Scope[]
    useExprs: UseExpr[]

    /**
     * All vids accessible from the current module, based on {@link useExprs}
     */
    references?: VirtualUseExpr[]
    /**
     * All vids that are "re-exported" from other modules, based on {@link useExprs}
     */
    reExports?: VirtualUseExpr[]
    /**
     * Persistent top level scope.
     * Different from scopeStack[0] because it is always available
     * If module is accessed during its check, use scopeStack.at(0) instead
     */
    topScope?: Scope
    compiled: boolean
    /**
     * List of resolved imports used by this module
     */
    imports: VirtualIdentifierMatch[]
    relImports: InstanceRelation[]
}

export const buildModuleAst = (
    node: ParseNode,
    id: VirtualIdentifier,
    source: Source,
    mod: boolean,
    compiled = false
): Module => {
    const nodes = filterNonAstNodes(node)
    const useExprs = nodes.filter(n => n.kind === 'use-stmt').map(buildUseExpr)
    const statements = nodes.filter(n => n.kind === 'statement').map(buildStatement)
    const block: Block = { kind: 'block', parseNode: node, statements }
    return {
        kind: 'module',
        parseNode: node,
        source,
        identifier: id,
        mod,
        block,
        scopeStack: [],
        useExprs,
        compiled,
        imports: [],
        relImports: []
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

export interface Arg extends AstNode<'arg'> {
    name?: Name
    expr: Expr
}

export const buildArg = (node: ParseNode): Arg => {
    const nodes = filterNonAstNodes(node)
    let i = 0
    const name = nodes[i].kind === 'name' ? buildName(nodes[i++]) : undefined
    const expr = buildExpr(nodes[i++])
    return { kind: 'arg', parseNode: node, name, expr }
}
