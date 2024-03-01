import { extractValue, nextVariable } from '.'
import { Module, Param } from '../../ast'
import { BinaryExpr, Expr, OperandExpr, UnaryExpr } from '../../ast/expr'
import { Operand } from '../../ast/operand'
import { Context } from '../../scope'
import { operatorImplMap } from '../../semantic/op'
import { todo } from '../../util/todo'
import { emitBlock } from './statement'

export interface EmitExpr {
    emit: string
    resultVar: string
}

export const emitExprToString = (expr: EmitExpr | string): string => {
    return typeof expr === 'string' ? expr : expr.emit
}

export const emitExpr = (expr: Expr, module: Module, ctx: Context, resultVar?: string): EmitExpr => {
    switch (expr.kind) {
        case 'operand-expr':
            return emitOperandExpr(expr, module, ctx)
        case 'unary-expr':
            return emitUnaryExpr(expr, module, ctx)
        case 'binary-expr':
            return emitBinaryExpr(expr, module, ctx)
    }
}

export const emitOperandExpr = (operandExpr: OperandExpr, module: Module, ctx: Context): EmitExpr => {
    return emitOperand(operandExpr.operand, module, ctx)
}

export const emitUnaryExpr = (unaryExpr: UnaryExpr, module: Module, ctx: Context): EmitExpr => {
    const resultVar = nextVariable(ctx)
    switch (unaryExpr.op.kind) {
        case 'call-op':
            const operand = emitOperand(unaryExpr.operand, module, ctx)
            const args = unaryExpr.op.args.map(a => emitExpr(a.expr, module, ctx))
            const call = `const ${resultVar} = ${operand.resultVar}(${args.map(a => a.resultVar)});`
            return {
                emit: [operand.emit, ...args.map(a => a.emit), call].join('\n'),
                resultVar
            }
        case 'unwrap-op':
            return { emit: '/*unwrap*/', resultVar }
        case 'bind-op':
            return { emit: '/*bind*/', resultVar }
    }
}

export const emitBinaryExpr = (binaryExpr: BinaryExpr, module: Module, ctx: Context): EmitExpr => {
    const lOp = emitOperand(binaryExpr.lOperand, module, ctx)
    const rOp = emitOperand(binaryExpr.rOperand, module, ctx)
    const resultVar = nextVariable(ctx)
    if (binaryExpr.binaryOp.kind === 'access-op') {
        return { emit: `const ${resultVar} = /*access-op*/;`, resultVar }
    }
    if (binaryExpr.binaryOp.kind === 'assign-op') {
        return {
            emit: [lOp.emit, rOp.emit, `${extractValue(lOp.resultVar)} = ${extractValue(rOp.resultVar)}`].join('\n'),
            resultVar
        }
    }
    const method = operatorImplMap.get(binaryExpr.binaryOp.kind)!.names.at(-1)!
    return { emit: `const ${resultVar} = ${lOp}.${method}(${rOp});`, resultVar }
}

export const emitOperand = (operand: Operand, module: Module, ctx: Context): EmitExpr => {
    const resultVar = nextVariable(ctx)
    switch (operand.kind) {
        case 'if-expr': {
            const { emit: cEmit, resultVar: cVar } = emitExpr(operand.condition, module, ctx)
            const thenBlock = emitBlock(operand.thenBlock, module, ctx, resultVar)
            const elseBlock = operand.elseBlock ? `else ${emitBlock(operand.elseBlock, module, ctx, resultVar)}` : ''
            return {
                emit: [`let ${resultVar};`, cEmit, `if (${extractValue(cVar)}) ${thenBlock} ${elseBlock}`].join('\n'),
                resultVar
            }
        }
        case 'if-let-expr':
            return { emit: '/*if-let*/', resultVar }
        case 'while-expr': {
            const { emit: cEmit, resultVar: cVar } = emitExpr(operand.condition, module, ctx)
            const block = emitBlock(operand.block, module, ctx)
            return { emit: [cEmit, `while (${extractValue(cVar)}) ${block}`].join('\n'), resultVar }
        }
        case 'for-expr':
            return { emit: '/*for*/', resultVar }
        case 'match-expr':
            return { emit: '/*match*/', resultVar }
        case 'closure-expr':
            const params = operand.params.map(p => emitParam(p, module, ctx)).join(', ')
            const block = emitBlock(operand.block, module, ctx)
            return { emit: `const ${resultVar} = function(${params}) => ${block};`, resultVar }
        case 'operand-expr':
        case 'unary-expr':
        case 'binary-expr':
            return emitExpr(operand, module, ctx)
        case 'list-expr':
            const items = operand.exprs.map(e => emitExpr(e, module, ctx))
            return {
                emit: [
                    ...items.map(i => i.emit),
                    `const ${resultVar} = List(${items.map(i => i.resultVar).join(', ')})`
                ].join('\n'),
                resultVar
            }
        case 'string-literal':
            return { emit: `const ${resultVar} = String(${operand.value});`, resultVar }
        case 'char-literal':
            return { emit: `const ${resultVar} = Char(${operand.value});`, resultVar }
        case 'int-literal':
            return { emit: `const ${resultVar} = Int(${operand.value});`, resultVar }
        case 'float-literal':
            return { emit: `const ${resultVar} = Float(${operand.value});`, resultVar }
        case 'bool-literal':
            return { emit: `const ${resultVar} = Bool(${operand.value});`, resultVar }
        case 'identifier':
            return { emit: `const ${resultVar} = ${operand.names.at(-1)!.value};`, resultVar }
    }
}

export const emitParam = (param: Param, module: Module, ctx: Context): string => {
    if (param.pattern.expr.kind !== 'name') {
        return todo('destructuring')
    }
    return param.pattern.expr.value
}
