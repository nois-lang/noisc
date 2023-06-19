import { Context, findImpl, vidToString } from '../scope'
import { AstNode, Module } from '../ast'
import { Statement, UseExpr } from '../ast/statement'
import { BinaryExpr, UnaryExpr } from '../ast/expr'
import { operatorImplMap } from './op'
import { Operand } from '../ast/operand'
import { virtualTypeToString } from '../typecheck'
import { CallOp } from '../ast/op'

export interface SemanticError {
    node: AstNode<any>
    message: string
}

export const checkModule = (module: Module, ctx: Context): void => {
    ctx.scopeStack.push({ statements: module.statements })

    module.useExprs.forEach(e => checkUseExpr(e, ctx))
    module.statements.forEach(s => checkStatement(s, ctx))

    ctx.scopeStack.pop()
}

const checkUseExpr = (useExpr: UseExpr, ctx: Context): void => {
    // todo
}

const checkStatement = (statement: Statement, ctx: Context): void => {
    switch (statement.kind) {
        case 'var-def':
            // todo
            break
        case 'fn-def':
            // todo
            break
        case 'kind-def':
            // todo
            break
        case 'impl-def':
            // todo
            break
        case 'type-def':
            // todo
            break
        case 'return-stmt':
            // todo
            break
        case 'operand-expr':
            // todo
            break
        case 'unary-expr':
            checkUnaryExpr(statement, ctx)
            break
        case 'binary-expr':
            checkBinaryExpr(statement, ctx)
            break
    }
}
const checkUnaryExpr = (unaryExpr: UnaryExpr, ctx: Context): void => {
    if (unaryExpr.unaryOp.kind === 'call-op') {
        checkCallExpr(unaryExpr, ctx)
    }
    // todo
}
const checkCallExpr = (unaryExpr: UnaryExpr, ctx: Context): void => {
    const callOp = <CallOp>unaryExpr.unaryOp
    const operand = unaryExpr.operand
    // todo
}

const checkBinaryExpr = (binaryExpr: BinaryExpr, ctx: Context): void => {
    checkOperand(binaryExpr.lOperand, ctx)
    checkOperand(binaryExpr.rOperand, ctx)
    const implId = operatorImplMap.get(binaryExpr.binaryOp.kind)
    if (!implId) return
    const impl = findImpl(implId, binaryExpr.lOperand.type!, ctx)
    if (!impl) {
        ctx.errors.push({
            node: binaryExpr.binaryOp,
            message: `no suitable impl \
${vidToString(implId)}(\
${virtualTypeToString(binaryExpr.lOperand.type!)}, \
${virtualTypeToString(binaryExpr.rOperand.type!)})}`
        })
    }
}

const checkOperand = (operand: Operand, ctx: Context): void => {
    switch (operand.kind) {
        case 'operand-expr':
            checkOperand(operand.operand, ctx)
            operand.type = operand.operand.type
            break
        case 'if-expr':
            // todo
            break
        case 'while-expr':
            // todo
            break
        case 'for-expr':
            // todo
            break
        case 'match-expr':
            // todo
            break
        case 'closure-expr':
            // todo
            break
        case 'unary-expr':
            checkUnaryExpr(operand, ctx)
            // todo
            break
        case 'binary-expr':
            checkBinaryExpr(operand, ctx)
            break
        case 'list-expr':
            // todo
            break
        case 'string-literal':
            operand.type = { kind: 'variant-type', identifier: { scope: ['std'], name: 'String' }, typeParams: [] }
            break
        case 'char-literal':
            operand.type = { kind: 'variant-type', identifier: { scope: ['std'], name: 'Char' }, typeParams: [] }
            break
        case 'int-literal':
            operand.type = { kind: 'variant-type', identifier: { scope: ['std'], name: 'Int' }, typeParams: [] }
            break
        case 'float-literal':
            operand.type = { kind: 'variant-type', identifier: { scope: ['std'], name: 'Float' }, typeParams: [] }
            break
        case 'identifier':
            // todo
            break
    }
}
