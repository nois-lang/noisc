import { ParseNode, filterNonAstNodes } from '../parser'
import { Context, Scope } from '../scope'
import { Source } from '../source'
import { InferredType } from '../typecheck'
import { BinaryExpr, Expr, OperandExpr, UnaryExpr, buildExpr } from './expr'
import { ConPattern, FieldPattern, Hole, ListPattern, MatchClause, MatchExpr, Pattern, buildPattern } from './match'
import {
    AddOp,
    AndOp,
    AssignOp,
    AwaitOp,
    BindOp,
    CallOp,
    ComposeOp,
    DivOp,
    EqOp,
    ExpOp,
    GeOp,
    GtOp,
    LeOp,
    LtOp,
    ModOp,
    MultOp,
    NeOp,
    OrOp,
    SubOp,
    UnwrapOp
} from './op'
import {
    BoolLiteral,
    CharLiteral,
    FloatLiteral,
    FnDef,
    ForExpr,
    Identifier,
    IntLiteral,
    ListExpr,
    Name,
    StringInterpolated,
    StringLiteral,
    WhileExpr,
    buildName
} from './operand'
import {
    Block,
    BreakStmt,
    ImplDef,
    ReturnStmt,
    TraitBlock,
    TraitDef,
    TraitStatement,
    UseExpr,
    VarDef,
    buildStatement,
    buildUseExpr
} from './statement'
import { FnType, ParamType, Type, TypeParam, buildType } from './type'
import { FieldDef, TypeDef, Variant } from './type-def'

export type AstNode =
    | Module
    | UseExpr
    | Variant
    | ReturnStmt
    | BreakStmt
    | Arg
    | Block
    | Param
    | FnType
    | ParamType
    | TypeParam
    | MatchClause
    | Pattern
    | ConPattern
    | ListPattern
    | FieldPattern
    | Hole
    | Identifier
    | Name
    | StringInterpolated
    | OperandExpr
    | UnaryExpr
    | BinaryExpr
    | ListExpr
    | FnDef
    | WhileExpr
    | ForExpr
    | MatchExpr
    | VarDef
    | TraitDef
    | TraitBlock
    | TraitStatement
    | ImplDef
    | TypeDef
    | FieldDef
    | StringLiteral
    | CharLiteral
    | IntLiteral
    | FloatLiteral
    | BoolLiteral
    | AddOp
    | SubOp
    | MultOp
    | DivOp
    | ExpOp
    | ModOp
    | EqOp
    | NeOp
    | GeOp
    | LeOp
    | GtOp
    | LtOp
    | AndOp
    | OrOp
    | AssignOp
    | ComposeOp
    | CallOp
    | UnwrapOp
    | BindOp
    | AwaitOp

export type BaseAstNode = {
    parseNode?: ParseNode
    type?: InferredType
}

export const astExprKinds = <const>[
    'operand-expr',
    'unary-expr',
    'binary-expr',
    'closure-expr',
    'list-expr',
    'fn-def',
    'while-expr',
    'for-expr',
    'match-expr'
]

export const astDefKinds = <const>['var-def', 'trait-def', 'impl-def', 'type-def', 'variant', 'field-def']

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

export const astPostfixOpKinds = <const>['compose-op', 'call-op', 'unwrap-op', 'bind-op', 'await-op']

export const astKinds = <const>[
    'module',
    'use-expr',
    'return-stmt',
    'break-stmt',
    'arg',
    'block',
    'trait-block',
    'trait-statement',
    'param',
    'type-bounds',
    'fn-type',
    'param-type',
    'type-param',
    'match-clause',
    'pattern',
    'con-pattern',
    'list-pattern',
    'field-pattern',
    'hole',
    'identifier',
    'name',
    'string-interpolated',
    ...astExprKinds,
    ...astDefKinds,
    ...astLiteralKinds,
    ...astInfixOpKinds,
    ...astPostfixOpKinds,
    'inferred',
    'const',
    'return'
]

export type AstNodeKind = (typeof astKinds)[number]

export const compactAstNode = (node: AstNode): any => {
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

export type Module = BaseAstNode & {
    kind: 'module'
    source: Source
    identifier: Identifier
    mod: boolean
    block: Block

    scopeStack: Scope[]
    useExprs: UseExpr[]

    /**
     * All vids accessible from the current module, based on {@link useExprs}
     */
    references?: Identifier[]
    /**
     * All vids that are "re-exported" from other modules, based on {@link useExprs}
     */
    reExports?: Identifier[]
    /**
     * Persistent top level scope
     */
    topScope: Scope
    compiled: boolean
    /**
     * List of resolved imports used by this module
     */
    imports: Identifier[]
    /**
     * Map of definitions accessible in this module via use exprs
     */
    useScope: Scope
    astStack: AstNode[]
    impls: ImplDef[]
}

export const buildModuleAst = (
    node: ParseNode,
    identifier: Identifier,
    source: Source,
    mod: boolean,
    ctx: Context,
    compiled = false
): Module => {
    const nodes = filterNonAstNodes(node)
    const useExprs = nodes.filter(n => n.kind === 'use-stmt').map(n => buildUseExpr(n, ctx))
    const statements = nodes.filter(n => n.kind === 'statement').map(n => buildStatement(n, ctx))
    const block: Block = { kind: 'block', parseNode: node, statements }
    return {
        kind: 'module',
        parseNode: node,
        source,
        identifier,
        mod,
        block,
        scopeStack: [],
        useExprs,
        topScope: { type: new Map(), value: new Map() },
        compiled,
        imports: [],
        useScope: { type: new Map(), value: new Map() },
        astStack: [],
        impls: []
    }
}

export type Param = BaseAstNode & {
    kind: 'param'
    pattern: Pattern
    paramType?: Type
}

export const buildParam = (node: ParseNode, ctx: Context): Param => {
    const nodes = filterNonAstNodes(node)
    const pattern = buildPattern(nodes[0], ctx)
    const typeNode = nodes.at(1)
    return { kind: 'param', parseNode: node, pattern, paramType: typeNode ? buildType(typeNode, ctx) : undefined }
}

export type Arg = BaseAstNode & {
    kind: 'arg'
    name?: Name
    expr: Expr
}

export const buildArg = (node: ParseNode, ctx: Context): Arg => {
    const nodes = filterNonAstNodes(node)
    let i = 0
    const name = nodes[i].kind === 'name' ? buildName(nodes[i++], ctx) : undefined
    const expr = buildExpr(nodes[i++], ctx)
    return { kind: 'arg', parseNode: node, name, expr }
}
