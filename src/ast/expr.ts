import { ParseNode, filterNonAstNodes } from '../parser'
import { Typed } from '../semantic'
import { assert } from '../util/todo'
import { AstNode } from './index'
import {
    BinaryOp,
    Call,
    PrefixOp,
    associativityMap,
    buildBinaryOp,
    buildCall,
    buildPrefixOp,
    isPrefixOp,
    precedenceMap
} from './op'
import { Operand, buildOperand } from './operand'

export type Expr = OperandExpr | UnaryExpr | BinaryExpr

export interface OperandExpr extends AstNode<'operand-expr'>, Partial<Typed> {
    operand: Operand
}

export const buildOperandExpr = (node: ParseNode): OperandExpr => {
    return {
        kind: 'operand-expr',
        parseNode: node,
        operand: buildOperand(node)
    }
}

export interface UnaryExpr extends AstNode<'unary-expr'>, Partial<Typed> {
    prefixOp?: PrefixOp
    call?: Call
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
        return buildSubExpr(nodes[0])
    }

    const operatorStack: (BinaryOp | PrefixOp | Call)[] = []
    const exprStack: (Operand | Expr)[] = []

    for (const n of nodes) {
        if (n.kind === 'sub-expr') {
            const expr = buildSubExpr(n)
            exprStack.push(expr.operand)
            if (expr.kind === 'unary-expr') {
                if (expr.prefixOp) {
                    operatorStack.push(expr.prefixOp)
                }
                if (expr.call) {
                    operatorStack.push(expr.call)
                }
            }
        } else {
            const o1 = buildBinaryOp(n)
            while (operatorStack.length !== 0) {
                const o2 = operatorStack.at(-1)!
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

                    if (isPrefixOp(o2)) {
                        exprStack.push({
                            kind: 'unary-expr',
                            parseNode: { kind: 'expr', nodes: [o2.parseNode, rExp.parseNode] },
                            prefixOp: o2,
                            operand: rExp
                        })
                    } else if (o2.kind === 'call') {
                        exprStack.push({
                            kind: 'unary-expr',
                            parseNode: { kind: 'expr', nodes: [rExp.parseNode, o2.parseNode] },
                            call: o2,
                            operand: rExp
                        })
                    } else {
                        const lExp = exprStack.pop()!
                        exprStack.push({
                            kind: 'binary-expr',
                            parseNode: { kind: 'expr', nodes: [lExp.parseNode, o2.parseNode, rExp.parseNode] },
                            binaryOp: o2,
                            lOperand: lExp,
                            rOperand: rExp
                        })
                    }
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
        if (isPrefixOp(op)) {
            // no need to wrap in additional unary-expr
            if (rExp.kind === 'unary-expr' && !rExp.prefixOp) {
                rExp.prefixOp = op
            } else {
                exprStack.push({
                    kind: 'unary-expr',
                    parseNode: { kind: 'expr', nodes: [rExp.parseNode, op.parseNode] },
                    prefixOp: op,
                    operand: rExp
                })
            }
        } else if (op.kind === 'call') {
            // no need to wrap in additional unary-expr
            if (rExp.kind === 'unary-expr' && !rExp.call) {
                rExp.call = op
            } else {
                exprStack.push({
                    kind: 'unary-expr',
                    parseNode: { kind: 'expr', nodes: [rExp.parseNode, op.parseNode] },
                    call: op,
                    operand: rExp
                })
            }
        } else {
            const lExp = exprStack.pop()!
            exprStack.push({
                kind: 'binary-expr',
                parseNode: { kind: 'expr', nodes: [lExp.parseNode, op.parseNode, rExp.parseNode] },
                binaryOp: op,
                lOperand: lExp,
                rOperand: rExp
            })
        }
    }
    assert(exprStack.length === 1, 'leftover expressions in the stack')
    const result = exprStack.pop()!
    assert(result.kind === 'operand-expr' || result.kind === 'unary-expr' || result.kind === 'binary-expr')
    return <Expr>result
}

export const buildSubExpr = (node: ParseNode): UnaryExpr | OperandExpr => {
    const nodes = filterNonAstNodes(node)
    if (nodes.length === 1) {
        return buildOperandExpr(nodes[0])
    }
    const prefixOp = nodes[0].kind === 'prefix-op' ? buildPrefixOp(nodes[0]) : undefined
    const call = nodes.at(-1)!.kind === 'call' ? buildCall(nodes.at(-1)!) : undefined
    return {
        kind: 'unary-expr',
        parseNode: node,
        prefixOp,
        call,
        operand: buildOperand(nodes[prefixOp ? 1 : 0])
    }
}
