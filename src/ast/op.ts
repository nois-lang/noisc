import { AstNode, AstNodeKind, buildFieldInit, FieldInit, filterNonAstNodes } from './index'
import { buildExpr, Expr } from './expr'
import { ParseNode, ParseTree } from '../parser'

export type UnaryOp = AddOp | SubOp | NotOp | SpreadOp | CallOp | ConOp

export const buildUnaryOp = (node: ParseNode): UnaryOp => {
    const n = filterNonAstNodes(node)[0]
    if (n.kind === 'call-op') {
        return buildCallOp(n)
    }
    if (n.kind === 'con-op') {
        return buildConOp(n)
    }
    if (!['add-op', 'sub-op', 'not-op', 'spread-op'].includes(n.kind)) {
        throw Error(`expected unary-op, got ${node.kind}`)
    }
    return { kind: <any>n.kind, parseNode: node }
}

export type BinaryOp
    = AddOp
    | SubOp
    | MultOp
    | DivOp
    | ExpOp
    | ModOp
    | AccessOp
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
    ['access-op', 'left'],
    ['eq-op', 'none'],
    ['ne-op', 'none'],
    ['ge-op', 'none'],
    ['le-op', 'none'],
    ['gt-op', 'none'],
    ['lt-op', 'none'],
    ['and-op', 'left'],
    ['or-op', 'left'],
    ['assign-op', 'none'],
])

export const precedenceMap: Map<AstNodeKind, number> = new Map([
    ['add-op', 6],
    ['sub-op', 6],
    ['mult-op', 7],
    ['div-op', 7],
    ['exp-op', 8],
    ['mod-op', 7],
    ['access-op', 9],
    ['eq-op', 4],
    ['ne-op', 4],
    ['ge-op', 4],
    ['le-op', 4],
    ['gt-op', 4],
    ['lt-op', 4],
    ['and-op', 3],
    ['or-op', 2],
    ['assign-op', 1],
])

export const buildBinaryOp = (node: ParseNode): BinaryOp => {
    if (![
        'add-op', 'sub-op', 'mult-op', 'div-op', 'exp-op', 'mod-op', 'access-op', 'eq-op', 'ne-op', 'ge-op', 'le-op',
        'gt-op', 'lt-op', 'and-op', 'or-op', 'assign-op'
    ].includes(node.kind)) {
        throw Error(`expected binary-op, got ${node.kind}`)
    }
    return { kind: <any>node.kind, parseNode: node }
}

export interface NotOp extends AstNode<'not-op'> {}

export interface SpreadOp extends AstNode<'spread-op'> {}

export interface CallOp extends AstNode<'call-op'> {
    args: Expr[]
}

export const buildCallOp = (node: ParseNode): CallOp => {
    const nodes = filterNonAstNodes(node)
    const argExprs = filterNonAstNodes(<ParseTree>nodes[0])
    return {
        kind: 'call-op',
        parseNode: node,
        args: argExprs.map(n => buildExpr(n))
    }
}

export interface ConOp extends AstNode<'con-op'> {
    fields: FieldInit[]
}

export const buildConOp = (node: ParseNode): ConOp => {
    const nodes = filterNonAstNodes(node)
    return {
        kind: 'con-op',
        parseNode: node,
        fields: nodes.map(n => buildFieldInit(n))
    }
}

export interface AddOp extends AstNode<'add-op'> {}

export interface SubOp extends AstNode<'sub-op'> {}

export interface MultOp extends AstNode<'mult-op'> {}

export interface DivOp extends AstNode<'div-op'> {}

export interface ExpOp extends AstNode<'exp-op'> {}

export interface ModOp extends AstNode<'mod-op'> {}

export interface AccessOp extends AstNode<'access-op'> {}

export interface EqOp extends AstNode<'eq-op'> {}

export interface NeOp extends AstNode<'ne-op'> {}

export interface GeOp extends AstNode<'ge-op'> {}

export interface LeOp extends AstNode<'le-op'> {}

export interface GtOp extends AstNode<'gt-op'> {}

export interface LtOp extends AstNode<'lt-op'> {}

export interface AndOp extends AstNode<'and-op'> {}

export interface OrOp extends AstNode<'or-op'> {}

export interface AssignOp extends AstNode<'assign-op'> {}
