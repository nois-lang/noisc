import { ParseNode, filterNonAstNodes } from '../parser'
import { Context } from '../scope'
import { Static } from '../semantic'
import { Arg, AstNode, AstNodeKind, BaseAstNode, buildArg } from './index'
import { Name, buildName } from './operand'
import { Type, buildType } from './type'

export type PostfixOp = MethodCallOp | FieldAccessOp | CallOp | UnwrapOp | BindOp | AwaitOp

export const isPostfixOp = (op: AstNode): op is PostfixOp => {
    return (
        op.kind === 'method-call-op' ||
        op.kind === 'field-access-op' ||
        op.kind === 'call-op' ||
        op.kind === 'unwrap-op' ||
        op.kind === 'bind-op' ||
        op.kind === 'await-op'
    )
}

export const buildPostfixOp = (node: ParseNode, ctx: Context): PostfixOp => {
    switch (node.kind) {
        case 'method-call-op':
            return buildMethodCallOp(node, ctx)
        case 'field-access-op':
            return buildFieldAccessOp(node, ctx)
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

export type MethodCallOp = BaseAstNode & {
    kind: 'method-call-op'
    name: Name
    typeArgs: Type[]
    call: CallOp
}

export const buildMethodCallOp = (node: ParseNode, ctx: Context): MethodCallOp => {
    const nodes = filterNonAstNodes(node)
    let i = 0
    const name = buildName(nodes[i++], ctx)
    const typeArgs = nodes[i].kind === 'type-args' ? filterNonAstNodes(nodes[i++]).map(n => buildType(n, ctx)) : []
    const call = buildCallOp(nodes[i++], ctx)
    return { kind: 'method-call-op', parseNode: node, name, typeArgs, call }
}

export type FieldAccessOp = BaseAstNode & {
    kind: 'field-access-op'
    name: Name
}

export const buildFieldAccessOp = (node: ParseNode, ctx: Context): FieldAccessOp => {
    const name = buildName(filterNonAstNodes(node)[0], ctx)
    return { kind: 'field-access-op', parseNode: node, name }
}

export type CallOp = BaseAstNode & {
    kind: 'call-op'
    args: Arg[]
    methodDef?: MethodDef
    variantDef?: VariantDef
    generics?: ConcreteGeneric[]
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
