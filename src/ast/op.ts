import { ParseNode, filterNonAstNodes } from '../parser'
import { InstanceRelation } from '../scope/trait'
import { MethodDef, VariantDef } from '../scope/vid'
import { ConcreteGeneric, VirtualGeneric, VirtualType } from '../typecheck'
import { Arg, AstNode, AstNodeKind, buildArg } from './index'

export type PostfixOp = CallOp | UnwrapOp | BindOp

export const isPostfixOp = (op: AstNode<AstNodeKind>): op is PostfixOp => {
    return op.kind === 'call-op' || op.kind === 'unwrap-op' || op.kind === 'bind-op'
}

export const buildPostfixOp = (node: ParseNode): PostfixOp => {
    if (node.kind === 'call-op') {
        return buildCallOp(node)
    }
    if (node.kind === 'unwrap-op' || node.kind === 'bind-op') {
        return { kind: node.kind, parseNode: node }
    }
    throw Error(`expected prefix-op, got ${node.kind}`)
}

export type BinaryOp =
    | AddOp
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
    ['access-op', 17],
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
            'access-op',
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

export interface CallOp extends AstNode<'call-op'> {
    args: Arg[]
    methodDef?: MethodDef
    impls?: InstanceRelation[]
    variantDef?: VariantDef
    generics?: ConcreteGeneric[]
}

export const buildCallOp = (node: ParseNode): CallOp => {
    const args = filterNonAstNodes(node).map(n => buildArg(n))
    return { kind: 'call-op', parseNode: node, args }
}

export interface UnwrapOp extends AstNode<'unwrap-op'> {}

export interface BindOp extends AstNode<'bind-op'> {}

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
