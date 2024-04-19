import { ParseNode, filterNonAstNodes } from '../parser'
import { MethodDef, VariantDef } from '../scope/vid'
import { Static } from '../semantic'
import { ConcreteGeneric } from '../typecheck'
import { Arg, AstNode, AstNodeKind, buildArg } from './index'
import { Name, buildName } from './operand'
import { Type, buildType } from './type'

export type PostfixOp = MethodCallOp | FieldAccessOp | CallOp | UnwrapOp | BindOp | AwaitOp

export const isPostfixOp = (op: AstNode<AstNodeKind>): op is PostfixOp => {
    return (
        op.kind === 'method-call-op' ||
        op.kind === 'field-access-op' ||
        op.kind === 'call-op' ||
        op.kind === 'unwrap-op' ||
        op.kind === 'bind-op' ||
        op.kind === 'await-op'
    )
}

export const buildPostfixOp = (node: ParseNode): PostfixOp => {
    switch (node.kind) {
        case 'method-call-op':
            return buildMethodCallOp(node)
        case 'field-access-op':
            return buildFieldAccessOp(node)
        case 'call-op':
            return buildCallOp(node)
        case 'unwrap-op':
        case 'bind-op':
        case 'await-op':
            return { kind: node.kind, parseNode: node }
        default:
            throw Error(`expected postfix-op, got ${node.kind}`)
    }
}

export type BinaryOp = (
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
) &
    Partial<Static>

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

export interface MethodCallOp extends AstNode<'method-call-op'> {
    name: Name
    typeArgs: Type[]
    call: CallOp
}

export const buildMethodCallOp = (node: ParseNode): MethodCallOp => {
    const nodes = filterNonAstNodes(node)
    let i = 0
    const name = buildName(nodes[i++])
    const typeArgs = nodes[i].kind === 'type-args' ? filterNonAstNodes(nodes[i++]).map(buildType) : []
    const call = buildCallOp(nodes[i++])
    return { kind: 'method-call-op', parseNode: node, name, typeArgs, call }
}

export interface FieldAccessOp extends AstNode<'field-access-op'> {
    name: Name
}

export const buildFieldAccessOp = (node: ParseNode): FieldAccessOp => {
    const name = buildName(filterNonAstNodes(node)[0])
    return { kind: 'field-access-op', parseNode: node, name }
}

export interface CallOp extends AstNode<'call-op'>, Partial<Static> {
    args: Arg[]
    methodDef?: MethodDef
    variantDef?: VariantDef
    generics?: ConcreteGeneric[]
}

export const buildCallOp = (node: ParseNode): CallOp => {
    const args = filterNonAstNodes(node).map(n => buildArg(n))
    return { kind: 'call-op', parseNode: node, args }
}

export interface UnwrapOp extends AstNode<'unwrap-op'> {}

export interface BindOp extends AstNode<'bind-op'> {}

export interface AwaitOp extends AstNode<'await-op'> {}

export interface AddOp extends AstNode<'add-op'> {}

export interface SubOp extends AstNode<'sub-op'> {}

export interface MultOp extends AstNode<'mult-op'> {}

export interface DivOp extends AstNode<'div-op'> {}

export interface ExpOp extends AstNode<'exp-op'> {}

export interface ModOp extends AstNode<'mod-op'> {}

export interface EqOp extends AstNode<'eq-op'> {}

export interface NeOp extends AstNode<'ne-op'> {}

export interface GeOp extends AstNode<'ge-op'> {}

export interface LeOp extends AstNode<'le-op'> {}

export interface GtOp extends AstNode<'gt-op'> {}

export interface LtOp extends AstNode<'lt-op'> {}

export interface AndOp extends AstNode<'and-op'> {}

export interface OrOp extends AstNode<'or-op'> {}

export interface AssignOp extends AstNode<'assign-op'> {}
