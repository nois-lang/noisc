import { ParseNode, filterNonAstNodes } from '../parser'
import { Context } from '../scope'
import { Expr } from './expr'
import { Arg, AstNode, AstNodeKind, BaseAstNode, buildArg } from './index'
import { buildIdentifier } from './operand'
import { buildBlock } from './statement'

export type PostfixOp = ComposeOp | CallOp | UnwrapOp | BindOp | AwaitOp

export const isPostfixOp = (op: AstNode): op is PostfixOp => {
    return (
        op.kind === 'compose-op' ||
        op.kind === 'call-op' ||
        op.kind === 'unwrap-op' ||
        op.kind === 'bind-op' ||
        op.kind === 'await-op'
    )
}

export const buildPostfixOp = (node: ParseNode, ctx: Context): PostfixOp => {
    switch (node.kind) {
        case 'compose-op':
            return buildComposeOp(node, ctx)
        case 'call-op':
            return buildCallOp(node, ctx)
        case 'unwrap-op':
        case 'bind-op':
        case 'await-op':
            return { kind: node.kind, parseNode: node }
        default:
            throw Error(`expected postfix-op, got ${node.kind}`)
    }
}

export type BinaryOp =
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

export type Associativity = 'left' | 'right' | 'none'

export const associativityMap: Map<AstNodeKind, Associativity> = new Map([
    ['add-op', 'left'],
    ['sub-op', 'left'],
    ['mult-op', 'left'],
    ['div-op', 'left'],
    ['exp-op', 'right'],
    ['mod-op', 'left'],
    ['eq-op', 'none'],
    ['ne-op', 'none'],
    ['ge-op', 'none'],
    ['le-op', 'none'],
    ['gt-op', 'none'],
    ['lt-op', 'none'],
    ['and-op', 'left'],
    ['or-op', 'left'],
    ['assign-op', 'none']
])

/**
 * Similar to JavaScript priority table
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_precedence#table
 */
export const precedenceMap: Map<AstNodeKind, number> = new Map([
    ['add-op', 11],
    ['sub-op', 11],
    ['mult-op', 12],
    ['div-op', 12],
    ['exp-op', 13],
    ['mod-op', 12],
    ['eq-op', 8],
    ['ne-op', 8],
    ['ge-op', 9],
    ['le-op', 9],
    ['gt-op', 9],
    ['lt-op', 9],
    ['and-op', 4],
    ['or-op', 3],
    ['assign-op', 2]
])

export const buildBinaryOp = (node: ParseNode): BinaryOp => {
    if (
        ![
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
        ].includes(node.kind)
    ) {
        throw Error(`expected binary-op, got ${node.kind}`)
    }
    return { kind: <any>node.kind, parseNode: node }
}

export type ComposeOp = BaseAstNode & {
    kind: 'compose-op'
    operand: Expr
}

export const buildComposeOp = (node: ParseNode, ctx: Context): ComposeOp => {
    const nodes = filterNonAstNodes(node)
    let i = 0
    let expr: Expr | undefined
    if (nodes.at(i)?.kind === 'identifier') {
        const id = buildIdentifier(nodes[i++], ctx)
        const idExpr: Expr = { kind: 'operand-expr', parseNode: id.parseNode, operand: id }
        if (nodes.at(i)?.kind === 'call-op') {
            const op = buildCallOp(nodes[i++], ctx)
            expr = {
                kind: 'unary-expr',
                parseNode: { kind: 'expr', nodes: [id, op].map(n => n.parseNode!) },
                operand: idExpr,
                op
            }
        } else {
            expr = idExpr
        }
    }
    if (nodes.at(i)?.kind === 'block') {
        const block = buildBlock(nodes[i++], ctx)
        expr = { kind: 'operand-expr', parseNode: block.parseNode, operand: block }
    }
    return { kind: 'compose-op', parseNode: node, operand: expr! }
}

export type CallOp = BaseAstNode & {
    kind: 'call-op'
    args: Arg[]
}

export const buildCallOp = (node: ParseNode, ctx: Context): CallOp => {
    const args = filterNonAstNodes(node).map(n => buildArg(n, ctx))
    return { kind: 'call-op', parseNode: node, args }
}

export type UnwrapOp = BaseAstNode & {
    kind: 'unwrap-op'
}

export type BindOp = BaseAstNode & {
    kind: 'bind-op'
}

export type AwaitOp = BaseAstNode & {
    kind: 'await-op'
}

export type AddOp = BaseAstNode & {
    kind: 'add-op'
}

export type SubOp = BaseAstNode & {
    kind: 'sub-op'
}

export type MultOp = BaseAstNode & {
    kind: 'mult-op'
}

export type DivOp = BaseAstNode & {
    kind: 'div-op'
}

export type ExpOp = BaseAstNode & {
    kind: 'exp-op'
}

export type ModOp = BaseAstNode & {
    kind: 'mod-op'
}

export type EqOp = BaseAstNode & {
    kind: 'eq-op'
}

export type NeOp = BaseAstNode & {
    kind: 'ne-op'
}

export type GeOp = BaseAstNode & {
    kind: 'ge-op'
}

export type LeOp = BaseAstNode & {
    kind: 'le-op'
}

export type GtOp = BaseAstNode & {
    kind: 'gt-op'
}

export type LtOp = BaseAstNode & {
    kind: 'lt-op'
}

export type AndOp = BaseAstNode & {
    kind: 'and-op'
}

export type OrOp = BaseAstNode & {
    kind: 'or-op'
}

export type AssignOp = BaseAstNode & {
    kind: 'assign-op'
}
