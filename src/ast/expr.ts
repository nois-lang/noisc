import { ParseNode, filterNonAstNodes } from '../parser'
import { Context, addError } from '../scope'
import { Typed, Virtual } from '../semantic'
import { invalidOperatorChainError } from '../semantic/error'
import { assert } from '../util/todo'
import { AstNode } from './index'
import { BinaryOp, PostfixOp, associativityMap, buildBinaryOp, buildPostfixOp, precedenceMap } from './op'
import { Operand, buildOperand } from './operand'

export type Expr = OperandExpr | UnaryExpr | BinaryExpr

export interface OperandExpr extends AstNode<'operand-expr'>, Partial<Typed>, Partial<Virtual> {
    operand: Operand
}

export const buildOperandExpr = (node: ParseNode, ctx: Context): OperandExpr => {
    return {
        kind: 'operand-expr',
        parseNode: node,
        operand: buildOperand(node, ctx)
    }
}

export interface UnaryExpr extends AstNode<'unary-expr'>, Partial<Typed>, Partial<Virtual> {
    operand: Operand
    op: PostfixOp
}

export interface BinaryExpr extends AstNode<'binary-expr'>, Partial<Typed>, Partial<Virtual> {
    binaryOp: BinaryOp
    lOperand: Operand
    rOperand: Operand
}

export const buildExpr = (node: ParseNode, ctx: Context): Expr => {
    const nodes = filterNonAstNodes(node)
    const operatorStack: BinaryOp[] = []
    const exprStack: (Expr | Operand)[] = []

    for (const n of nodes) {
        if (n.kind === 'sub-expr') {
            const expr = buildSubExpr(n, ctx)
            exprStack.push(expr)
        } else {
            const o1 = buildBinaryOp(n)
            while (operatorStack.length !== 0) {
                const o2 = operatorStack.at(-1)!
                const o1Prec = precedenceMap.get(o1.kind)!
                const o2Prec = precedenceMap.get(o2.kind)!
                const o1Assoc = associativityMap.get(o1.kind)!
                const o2Assoc = associativityMap.get(o2.kind)!
                if (o1Prec === o2Prec && o1Assoc === 'none' && o2Assoc === 'none') {
                    addError(ctx, invalidOperatorChainError(ctx, o1, o2))
                    break
                }
                if ((o1Assoc !== 'right' && o1Prec === o2Prec) || o1Prec < o2Prec) {
                    operatorStack.pop()
                    const rExp = exprStack.pop()!
                    const lExp = exprStack.pop()!
                    exprStack.push({
                        kind: 'binary-expr',
                        parseNode: { kind: 'expr', nodes: [lExp.parseNode, o2.parseNode, rExp.parseNode] },
                        binaryOp: o2,
                        lOperand: lExp,
                        rOperand: rExp
                    })
                } else {
                    break
                }
            }
            operatorStack.push(o1)
        }
    }

    while (operatorStack.length !== 0) {
        const op = operatorStack.pop()!
        const rExp = exprStack.pop()!
        const lExp = exprStack.pop()!
        exprStack.push({
            kind: 'binary-expr',
            parseNode: { kind: 'expr', nodes: [lExp.parseNode, op.parseNode, rExp.parseNode] },
            binaryOp: op,
            lOperand: lExp,
            rOperand: rExp
        })
    }
    assert(exprStack.length === 1, 'leftover expressions in the stack')
    let result = exprStack.pop()!
    if (result.kind !== 'operand-expr' && result.kind !== 'unary-expr' && result.kind !== 'binary-expr') {
        result = { kind: 'operand-expr', parseNode: result.parseNode, operand: result }
    }
    return result
}

export const buildSubExpr = (node: ParseNode, ctx: Context): UnaryExpr | Operand => {
    const nodes = filterNonAstNodes(node)
    const operand = buildOperand(nodes[0], ctx)
    const ops = nodes.slice(1).map(n => buildPostfixOp(n, ctx))
    if (ops.length === 0) {
        return operand
    }
    let expr: UnaryExpr | Operand = operand
    // fold a list of ops into left-associative unary-exprs
    for (const op of ops) {
        expr = {
            kind: 'unary-expr',
            parseNode: { kind: 'expr', nodes: [expr.parseNode, op.parseNode] },
            operand: expr,
            op
        }
    }
    return <UnaryExpr>expr
}
