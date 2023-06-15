import { associativityMap, BinaryOp, buildBinaryOp, buildUnaryOp, precedenceMap, UnaryOp } from './op'
import { AstNode, filterNonAstNodes } from './index'
import { ParseNode } from '../parser/parser'
import { buildOperand, Operand } from './operand'

export type Expr = OperandExpr | UnaryExpr | BinaryExpr

export interface OperandExpr extends AstNode<'operand-expr'> {
    operand: Operand
}

export const buildOperandExpr = (node: ParseNode): OperandExpr => {
    return {
        type: 'operand-expr',
        parseNode: node,
        operand: buildOperand(node)
    }
}

export interface UnaryExpr extends AstNode<'unary-expr'> {
    unaryOp: UnaryOp
    operand: Operand
}

export interface BinaryExpr extends AstNode<'binary-expr'> {
    binaryOp: BinaryOp
    lOperand: Operand
    rOperand: Operand
}

export const buildExpr = (node: ParseNode): Expr => {
    const nodes = filterNonAstNodes(node)
    if (nodes.length === 1) {
        return buildSubExpr(nodes[0])
    } else {
        return buildBinaryExpr(node)
    }
}

export const buildSubExpr = (node: ParseNode): Expr => {
    const nodes = filterNonAstNodes(node)
    if (nodes.length === 1) {
        return {
            type: 'operand-expr',
            parseNode: node,
            operand: buildOperandExpr(node)
        }
    }
    const isPrefix = nodes[0].kind === 'prefix-op'
    return {
        type: 'unary-expr',
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
                const o1Prec = precedenceMap.get(o1.type)!
                const o2Prec = precedenceMap.get(o2.type)!
                const o1Assoc = associativityMap.get(o1.type)!
                const o2Assoc = associativityMap.get(o2.type)!
                if (o1Prec === o2Prec && o1Assoc === 'none' && o2Assoc === 'none') {
                    throw Error(`cannot chain operators \`${o1.type}\` and \`${o2.type}\``)
                }
                if ((o1Assoc !== 'right' && o1Prec === o2Prec) || o1Prec < o2Prec) {
                    operatorStack.pop()
                    const lExp = exprStack.pop()!
                    const rExp = exprStack.pop()!
                    exprStack.push({
                        type: 'binary-expr',
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
            const expr = buildExpr(n)
            exprStack.push(expr)
        }
    }

    while (operatorStack.length !== 0) {
        const op = operatorStack.pop()!
        const rExp = exprStack.pop()!
        const lExp = exprStack.pop()!
        exprStack.push({
            type: 'binary-expr',
            parseNode: lExp.parseNode,
            binaryOp: op,
            lOperand: lExp,
            rOperand: rExp
        })
    }
    return exprStack.pop()!
}
