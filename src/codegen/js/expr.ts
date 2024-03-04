import { extractValue, indent, jsRelName, jsString, jsTodo, jsVariable, nextVariable } from '.'
import { Module, Param } from '../../ast'
import { BinaryExpr, Expr, OperandExpr, UnaryExpr } from '../../ast/expr'
import { MatchExpr, PatternExpr } from '../../ast/match'
import { Operand } from '../../ast/operand'
import { Context } from '../../scope'
import { relTypeName } from '../../scope/trait'
import { operatorImplMap } from '../../semantic/op'
import { todo, unreachable } from '../../util/todo'
import { emitBlock } from './statement'

export interface EmitExpr {
    emit: string
    resultVar: string
}

export const emitExprToString = (expr: EmitExpr | string): string => {
    return typeof expr === 'string' ? expr : expr.emit
}

export const emitExpr = (expr: Expr, module: Module, ctx: Context): EmitExpr => {
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
            const args = unaryExpr.op.args.map(a => emitExpr(a.expr, module, ctx))
            const impls: string[] = []
            if (unaryExpr.op.impls !== undefined && unaryExpr.op.impls.length > 0) {
                for (const impl of unaryExpr.op.impls) {
                    impls.push(`${resultVar}.${relTypeName(impl)} = ${jsRelName(impl)};`)
                }
            }
            const variantDef = unaryExpr.op.variantDef
            if (variantDef) {
                const variantName = `${variantDef.typeDef.name.value}.${variantDef.variant.name.value}`
                const call = jsVariable(resultVar, `${variantName}(${args.map(a => a.resultVar).join(', ')})`)
                return {
                    emit: [...args.map(a => a.emit), call, ...impls].join('\n'),
                    resultVar
                }
            } else {
                const operand = emitOperand(unaryExpr.operand, module, ctx)
                const call = jsVariable(resultVar, `${operand.resultVar}(${args.map(a => a.resultVar).join(', ')})`)
                return {
                    emit: [operand.emit, ...args.map(a => a.emit), call, ...impls].join('\n'),
                    resultVar
                }
            }
        case 'unwrap-op':
            return { emit: jsTodo('unwrap-op'), resultVar }
        case 'bind-op':
            return { emit: jsTodo('bind'), resultVar }
    }
}

export const emitBinaryExpr = (binaryExpr: BinaryExpr, module: Module, ctx: Context): EmitExpr => {
    const lOp = emitOperand(binaryExpr.lOperand, module, ctx)
    const resultVar = nextVariable(ctx)
    if (binaryExpr.binaryOp.kind === 'access-op') {
        if (binaryExpr.rOperand.kind === 'identifier') {
            const accessor = binaryExpr.rOperand.names.at(-1)!.value
            return {
                emit: [lOp.emit, jsVariable(resultVar, `${lOp.resultVar}.${accessor}`)].join('\n'),
                resultVar
            }
        }
        if (binaryExpr.rOperand.kind === 'unary-expr' && binaryExpr.rOperand.op.kind === 'call-op') {
            const callOp = binaryExpr.rOperand.op
            const methodDef = callOp.methodDef!
            const traitName = relTypeName(methodDef.rel)
            const methodName = methodDef.fn.name.value
            const args = callOp.args.map(a => emitExpr(a.expr, module, ctx))
            const argsEmit = (methodDef.fn.static ? args : [lOp.resultVar, ...args.map(a => a.resultVar)]).join(', ')
            return {
                emit: [
                    lOp.emit,
                    ...args.map(a => a.emit),
                    jsVariable(resultVar, `${lOp.resultVar}.${traitName}.${methodName}(${argsEmit})`)
                ].join('\n'),
                resultVar
            }
        }
        return {
            emit: jsTodo('unwrap/bind ops'),
            resultVar
        }
    }
    const rOp = emitOperand(binaryExpr.rOperand, module, ctx)
    if (binaryExpr.binaryOp.kind === 'assign-op') {
        return {
            emit: [lOp.emit, rOp.emit, `${extractValue(lOp.resultVar)} = ${extractValue(rOp.resultVar)}`].join('\n'),
            resultVar
        }
    }
    const method = operatorImplMap.get(binaryExpr.binaryOp.kind)!.names.at(-1)!
    return { emit: jsVariable(resultVar, `${lOp}.${method}(${rOp})`), resultVar }
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
            return { emit: jsTodo('if-let'), resultVar }
        case 'while-expr': {
            const { emit: cEmit, resultVar: cVar } = emitExpr(operand.condition, module, ctx)
            const block = emitBlock(operand.block, module, ctx)
            return { emit: [cEmit, `while (${extractValue(cVar)}) ${block}`].join('\n'), resultVar }
        }
        case 'for-expr':
            return { emit: jsTodo('for'), resultVar }
        case 'match-expr':
            return emitMatchExpr(operand, module, ctx, resultVar)
        case 'closure-expr':
            const params = operand.params.map(p => emitParam(p, module, ctx)).join(', ')
            const block = emitBlock(operand.block, module, ctx)
            return { emit: jsVariable(resultVar, `function(${params}) ${block}`), resultVar }
        case 'operand-expr':
        case 'unary-expr':
        case 'binary-expr':
            return emitExpr(operand, module, ctx)
        case 'list-expr':
            const items = operand.exprs.map(e => emitExpr(e, module, ctx))
            return {
                emit: [
                    ...items.map(i => i.emit),
                    jsVariable(resultVar, `List(${items.map(i => i.resultVar).join(', ')})`)
                ].join('\n'),
                resultVar
            }
        case 'string-literal':
            return { emit: jsVariable(resultVar, `String.String(${operand.value})`), resultVar }
        case 'char-literal':
            return { emit: jsVariable(resultVar, `Char.Char(${operand.value})`), resultVar }
        case 'int-literal':
            return { emit: jsVariable(resultVar, `Int.Int(${operand.value})`), resultVar }
        case 'float-literal':
            return { emit: jsVariable(resultVar, `Float.Float(${operand.value})`), resultVar }
        case 'bool-literal':
            return { emit: jsVariable(resultVar, `Bool.Bool(${operand.value})`), resultVar }
        case 'identifier':
            return { emit: jsVariable(resultVar, operand.names.at(-1)!.value), resultVar }
    }
}

export const emitMatchExpr = (matchExpr: MatchExpr, module: Module, ctx: Context, resultVar: string): EmitExpr => {
    const { emit: sEmit, resultVar: sVar } = emitExpr(matchExpr.expr, module, ctx)
    if (matchExpr.clauses.length === 0) {
        return { emit: '', resultVar }
    }
    const clauses = matchExpr.clauses.map(clause => {
        if (clause.patterns.length !== 1) return jsTodo('union clause')
        const pattern = clause.patterns[0]
        const cond = emitPatternExprCondition(pattern.expr, module, ctx, sVar)
        const block = emitBlock(clause.block, module, ctx, resultVar)
        // TODO: inject aliases and fields in block's scope
        return [cond.emit, `if (${cond.resultVar}) ${block}`].join('\n')
    })
    let ifElseChain = clauses[0]
    for (let i = 1; i < clauses.length; i++) {
        const clause = clauses[i]
        ifElseChain += ` else {\n${indent(clause, i)}`
    }
    for (let i = clauses.length - 2; i >= 0; i--) {
        ifElseChain += `\n${indent('}', i)}`
    }
    return {
        emit: [jsVariable(resultVar), sEmit, ifElseChain].join('\n'),
        resultVar
    }
}

export const emitPatternExprCondition = (
    patternExpr: PatternExpr,
    module: Module,
    ctx: Context,
    sVar: string
): EmitExpr => {
    const resultVar = nextVariable(ctx)
    switch (patternExpr.kind) {
        case 'con-pattern':
            const variantName = patternExpr.identifier.names.at(-1)!.value
            const cond = `${sVar}.$noisVariant === ${jsString(variantName)}`
            // TODO: nested patterns
            return { emit: jsVariable(resultVar, cond), resultVar }
        case 'hole':
            return { emit: jsVariable(resultVar, 'true'), resultVar }
        case 'string-literal':
        case 'char-literal':
        case 'int-literal':
        case 'float-literal':
        case 'bool-literal':
            return { emit: jsVariable(resultVar, jsTodo('literal')), resultVar }
        case 'list-expr':
        case 'operand-expr':
        case 'unary-expr':
        case 'binary-expr':
        case 'identifier':
        case 'name':
        case 'if-expr':
        case 'if-let-expr':
        case 'while-expr':
        case 'for-expr':
        case 'match-expr':
        case 'closure-expr':
            return unreachable()
    }
}

export const emitParam = (param: Param, module: Module, ctx: Context): string => {
    if (param.pattern.expr.kind !== 'name') {
        return todo('destructuring')
    }
    return param.pattern.expr.value
}
