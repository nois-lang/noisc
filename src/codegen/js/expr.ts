import { extractValue } from '.'
import { Module, Param } from '../../ast'
import { BinaryExpr, Expr, OperandExpr, UnaryExpr } from '../../ast/expr'
import { Operand } from '../../ast/operand'
import { Context } from '../../scope'
import { operatorImplMap } from '../../semantic/op'
import { todo } from '../../util/todo'
import { emitBlock } from './statement'

export const emitExpr = (expr: Expr, module: Module, ctx: Context): string => {
    switch (expr.kind) {
        case 'operand-expr':
            return emitOperandExpr(expr, module, ctx)
        case 'unary-expr':
            return emitUnaryExpr(expr, module, ctx)
        case 'binary-expr':
            return emitBinaryExpr(expr, module, ctx)
    }
}

export const emitOperandExpr = (operandExpr: OperandExpr, module: Module, ctx: Context): string => {
    return emitOperand(operandExpr.operand, module, ctx)
}

export const emitUnaryExpr = (unaryExpr: UnaryExpr, module: Module, ctx: Context): string => {
    switch (unaryExpr.op.kind) {
        case 'call-op':
            const operand = emitOperand(unaryExpr.operand, module, ctx)
            const args = unaryExpr.op.args.map(a => emitExpr(a.expr, module, ctx)).join(', ')
            return `${operand}(${args})`
        case 'unwrap-op':
            return '/*unwrap*/'
        case 'bind-op':
            return '/*bind*/'
    }
}

export const emitBinaryExpr = (binaryExpr: BinaryExpr, module: Module, ctx: Context): string => {
    const lOp = emitOperand(binaryExpr.lOperand, module, ctx)
    const rOp = emitOperand(binaryExpr.rOperand, module, ctx)
    if (binaryExpr.binaryOp.kind === 'access-op') {
        return `${lOp}.${rOp}`
    }
    if (binaryExpr.binaryOp.kind === 'assign-op') {
        return `${extractValue(lOp)} = ${extractValue(rOp)}`
    }
    const method = operatorImplMap.get(binaryExpr.binaryOp.kind)!.names.at(-1)!
    return `${lOp}.${method}(${rOp})`
}

export const emitOperand = (operand: Operand, module: Module, ctx: Context): string => {
    switch (operand.kind) {
        case 'if-expr': {
            const condition = extractValue(emitExpr(operand.condition, module, ctx))
            const thenBlock = emitBlock(operand.thenBlock, module, ctx)
            const elseBlock = operand.elseBlock ? ` else ${emitBlock(operand.elseBlock, module, ctx)}` : ' '
            return `if (${condition}) ${thenBlock}${elseBlock}`
        }
        case 'if-let-expr':
            return '/*if-let*/'
        case 'while-expr': {
            const condition = extractValue(emitExpr(operand.condition, module, ctx))
            const block = emitBlock(operand.block, module, ctx)
            return `while (${condition}) ${block}`
        }
        case 'for-expr':
            return '/*for*/'
        case 'match-expr':
            return '/*match*/'
        case 'closure-expr':
            const params = operand.params.map(p => emitParam(p, module, ctx)).join(', ')
            const block = emitBlock(operand.block, module, ctx)
            return `function(${params}) => ${block}`
        case 'operand-expr':
        case 'unary-expr':
        case 'binary-expr':
            return emitExpr(operand, module, ctx)
        case 'list-expr':
            return `List(${operand.exprs.map(e => emitExpr(e, module, ctx)).join(', ')})`
        case 'string-literal':
            return `String(${operand.value})`
        case 'char-literal':
            return `Char(${operand.value})`
        case 'int-literal':
            return `Int(${operand.value})`
        case 'float-literal':
            return `Float(${operand.value})`
        case 'bool-literal':
            return `Bool(${operand.value})`
        case 'identifier':
            return operand.names.at(-1)!.value
    }
}

export const emitParam = (param: Param, module: Module, ctx: Context): string => {
    if (param.pattern.expr.kind !== 'name') {
        return todo('destructuring')
    }
    return param.pattern.expr.value
}
