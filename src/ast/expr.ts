import { associativityMap, BinaryOp, buildBinaryOp, buildUnaryOp, precedenceMap, UnaryOp } from './op'
import { AstNode, filterNonAstNodes } from './index'
import { buildOperand, Operand } from './operand'
import { ParseNode } from '../parser'
import { Typed } from '../typecheck'

export type Expr = OperandExpr | UnaryExpr | BinaryExpr

export interface OperandExpr extends AstNode<'operand-expr'>, Partial<Typed> {
    operand: Operand
}

export const buildOperandExpr = (node: ParseNode): OperandExpr => {
    return {
        kind: 'operand-expr',
        parseNode: node,
        operand: buildOperand(node),
    }
}

export interface UnaryExpr extends AstNode<'unary-expr'>, Partial<Typed> {
    unaryOp: UnaryOp
    operand: Operand
}

export interface BinaryExpr extends AstNode<'binary-expr'>, Partial<Typed> {
    binaryOp: BinaryOp
    lOperand: Operand
    rOperand: Operand
}

export const buildExpr = (node: ParseNode): Expr => {
    const nodes = filterNonAstNodes(node)
    if (nodes.length === 1) {
        if (node.kind === 'expr') {
            return buildExpr(nodes[0])
        } else {
            return buildSubExpr(node)
        }
    }
    if (nodes.length === 2) {
        return buildSubExpr(node)
    }
    return buildBinaryExpr(node)
}

export const buildSubExpr = (node: ParseNode): Expr => {
    const nodes = filterNonAstNodes(node)
    if (nodes.length === 1) {
        return buildOperandExpr(nodes[0])
    }
    const isPrefix = nodes[0].kind === 'prefix-op'
    return {
        kind: 'unary-expr',
        parseNode: node,
        unaryOp: buildUnaryOp(nodes[isPrefix ? 0 : 1]),
        operand: buildOperand(nodes[isPrefix ? 1 : 0])
    }
}
export const buildBinaryExpr = (node: ParseNode): Expr => {
    const nodes = filterNonAstNodes(node)
    const operatorStack: BinaryOp[] = []
    const exprStack: Expr[] = []

    for (const n of nodes) {
        if (n.kind.endsWith('-op')) {
            const o1 = buildBinaryOp(n)
            let o2
            while (operatorStack.length !== 0) {
                o2 = operatorStack.at(-1)!
                const o1Prec = precedenceMap.get(o1.kind)!
                const o2Prec = precedenceMap.get(o2.kind)!
                const o1Assoc = associativityMap.get(o1.kind)!
                const o2Assoc = associativityMap.get(o2.kind)!
                if (o1Prec === o2Prec && o1Assoc === 'none' && o2Assoc === 'none') {
                    throw Error(`cannot chain operators \`${o1.kind}\` and \`${o2.kind}\``)
                }
                if ((o1Assoc !== 'right' && o1Prec === o2Prec) || o1Prec < o2Prec) {
                    operatorStack.pop()
                    const rExp = exprStack.pop()!
                    const lExp = exprStack.pop()!
                    exprStack.push({
                        kind: 'binary-expr',
                        parseNode: lExp.parseNode,
                        binaryOp: o2,
                        lOperand: lExp,
                        rOperand: rExp
                    })
                } else {
                    break
                }
            }
            operatorStack.push(o1)
        } else {
            const expr = buildSubExpr(n)
            exprStack.push(expr)
        }
    }

    while (operatorStack.length !== 0) {
        const op = operatorStack.pop()!
        const rExp = exprStack.pop()!
        const lExp = exprStack.pop()!
        exprStack.push({
            kind: 'binary-expr',
            parseNode: lExp.parseNode,
            binaryOp: op,
            lOperand: lExp,
            rOperand: rExp
        })
    }
    return exprStack.pop()!
}
