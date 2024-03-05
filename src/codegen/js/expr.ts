import { emitLines, extractValue, indent, jsError, jsRelName, jsString, jsVariable, nextVariable } from '.'
import { Module, Param } from '../../ast'
import { BinaryExpr, Expr, OperandExpr, UnaryExpr } from '../../ast/expr'
import { MatchExpr, Pattern, PatternExpr } from '../../ast/match'
import { Operand } from '../../ast/operand'
import { Context } from '../../scope'
import { relTypeName } from '../../scope/trait'
import { operatorImplMap } from '../../semantic/op'
import { unreachable } from '../../util/todo'
import { emitBlock, emitBlockStatements } from './statement'

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
            if (unaryExpr.op.impls !== undefined) {
                for (const impl of unaryExpr.op.impls) {
                    impls.push(`${resultVar}.${relTypeName(impl)} = ${jsRelName(impl)};`)
                }
            }
            const variantDef = unaryExpr.op.variantDef
            if (variantDef) {
                const variantName = `${variantDef.typeDef.name.value}.${variantDef.variant.name.value}`
                const call = jsVariable(resultVar, `${variantName}(${args.map(a => a.resultVar).join(', ')})`)
                return {
                    emit: emitLines([...args.map(a => a.emit), call, ...impls]),
                    resultVar
                }
            } else {
                const operand = emitOperand(unaryExpr.operand, module, ctx)
                const call = jsVariable(resultVar, `${operand.resultVar}(${args.map(a => a.resultVar).join(', ')})`)
                return {
                    emit: emitLines([operand.emit, ...args.map(a => a.emit), call, ...impls]),
                    resultVar
                }
            }
        case 'unwrap-op':
            return { emit: jsError('unwrap-op'), resultVar }
        case 'bind-op':
            return { emit: jsError('bind'), resultVar }
    }
}

export const emitBinaryExpr = (binaryExpr: BinaryExpr, module: Module, ctx: Context): EmitExpr => {
    const lOp = emitOperand(binaryExpr.lOperand, module, ctx)
    const resultVar = nextVariable(ctx)
    if (binaryExpr.binaryOp.kind === 'access-op') {
        if (binaryExpr.rOperand.kind === 'identifier') {
            const accessor = binaryExpr.rOperand.names.at(-1)!.value
            return {
                emit: emitLines([lOp.emit, jsVariable(resultVar, `${lOp.resultVar}.${accessor}`)]),
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
                emit: emitLines([
                    lOp.emit,
                    emitLines(args.map(a => a.emit)),
                    jsVariable(resultVar, `${lOp.resultVar}.${traitName}.${methodName}(${argsEmit})`)
                ]),
                resultVar
            }
        }
        return {
            emit: jsError('unwrap/bind ops'),
            resultVar
        }
    }
    const rOp = emitOperand(binaryExpr.rOperand, module, ctx)
    if (binaryExpr.binaryOp.kind === 'assign-op') {
        return {
            emit: emitLines([lOp.emit, rOp.emit, `${extractValue(lOp.resultVar)} = ${extractValue(rOp.resultVar)}`]),
            resultVar
        }
    }
    const trait = operatorImplMap.get(binaryExpr.binaryOp.kind)!.names.at(-2)!
    const method = operatorImplMap.get(binaryExpr.binaryOp.kind)!.names.at(-1)!
    const assign = jsVariable(resultVar, `${lOp.resultVar}.${trait}.${method}(${lOp.resultVar}, ${rOp.resultVar})`)
    return {
        emit: emitLines([lOp.emit, rOp.emit, assign]),
        resultVar
    }
}

export const emitOperand = (operand: Operand, module: Module, ctx: Context): EmitExpr => {
    const resultVar = nextVariable(ctx)
    switch (operand.kind) {
        case 'if-expr': {
            const { emit: cEmit, resultVar: cVar } = emitExpr(operand.condition, module, ctx)
            const thenBlock = emitBlock(operand.thenBlock, module, ctx, resultVar)
            const elseBlock = operand.elseBlock ? `else ${emitBlock(operand.elseBlock, module, ctx, resultVar)}` : ''
            return {
                emit: emitLines([jsVariable(resultVar), cEmit, `if (${extractValue(cVar)}) ${thenBlock} ${elseBlock}`]),
                resultVar
            }
        }
        case 'if-let-expr':
            return { emit: jsError('if-let'), resultVar }
        case 'while-expr': {
            const { emit: cEmit, resultVar: cVar } = emitExpr(operand.condition, module, ctx)
            const block = emitBlock(operand.block, module, ctx)
            return { emit: emitLines([cEmit, `while (${extractValue(cVar)}) ${block}`]), resultVar }
        }
        case 'for-expr': {
            const expr = emitExpr(operand.expr, module, ctx)
            const iteratorVar = nextVariable(ctx)
            const iterator = {
                emit: emitLines([
                    expr.emit,
                    // TODO: do not invoke `iter` if it is already Iter
                    jsVariable(iteratorVar, `${expr.resultVar}.Iterable.iter(${expr.resultVar})`)
                ]),
                resultVar: iteratorVar
            }
            const iterateeVar = nextVariable(ctx)
            const thenBlock = emitLines([
                emitPattern(operand.pattern, module, ctx, `${iterateeVar}.value`),
                ...emitBlockStatements(operand.block, module, ctx)
            ])
            const block = emitLines([
                jsVariable(iterateeVar, `${iterator.resultVar}.Iter.next(${iterator.resultVar})`),
                `if (${iterateeVar}.$noisVariant === "Some") {`,
                indent(thenBlock),
                `} else {`,
                indent(`break;`),
                `}`
            ])
            const forEmit = emitLines([iterator.emit, 'while (true) {', indent(block), '}'])
            return { emit: emitLines([jsVariable(resultVar), forEmit]), resultVar: jsError('no use') }
        }
        case 'match-expr':
            return emitMatchExpr(operand, module, ctx, resultVar)
        case 'closure-expr': {
            const params = operand.params.map(p => emitParam(p, module, ctx)).join(', ')
            const block = emitBlock(operand.block, module, ctx)
            return { emit: jsVariable(resultVar, `function(${params}) ${block}`), resultVar }
        }
        case 'operand-expr':
        case 'unary-expr':
        case 'binary-expr':
            return emitExpr(operand, module, ctx)
        case 'list-expr':
            const items = operand.exprs.map(e => emitExpr(e, module, ctx))
            const impls: string[] = []
            if (operand.impls !== undefined) {
                for (const impl of operand.impls) {
                    impls.push(`${resultVar}.${relTypeName(impl)} = ${jsRelName(impl)};`)
                }
            }
            return {
                emit: emitLines([
                    ...items.map(i => i.emit),
                    jsVariable(resultVar, `List.List(${items.map(i => i.resultVar).join(', ')})`),
                    ...impls
                ]),
                resultVar
            }
        case 'string-literal':
        case 'char-literal':
        case 'int-literal':
        case 'float-literal':
        case 'bool-literal':
            return emitLiteral(operand, module, ctx, resultVar)
        case 'identifier':
            return { emit: '', resultVar: operand.names.at(-1)!.value }
    }
}

export const emitLiteral = (operand: Operand, module: Module, ctx: Context, resultVar: string): EmitExpr => {
    let constructorEmit: string
    switch (operand.kind) {
        case 'string-literal':
            constructorEmit = `String.String(${operand.value})`
            break
        case 'char-literal':
            constructorEmit = `Char.Char(${operand.value})`
            break
        case 'int-literal':
            constructorEmit = `Int.Int(${operand.value})`
            break
        case 'float-literal':
            constructorEmit = `Float.Float(${operand.value})`
            break
        case 'bool-literal':
            constructorEmit = `Bool.Bool(${operand.value})`
            break
        default:
            return unreachable()
    }
    const impls: string[] = []
    if (operand.impls !== undefined) {
        for (const impl of operand.impls) {
            impls.push(`${resultVar}.${relTypeName(impl)} = ${jsRelName(impl)};`)
        }
    }
    return { emit: emitLines([jsVariable(resultVar, constructorEmit), ...impls]), resultVar }
}

export const emitMatchExpr = (matchExpr: MatchExpr, module: Module, ctx: Context, resultVar: string): EmitExpr => {
    const { emit: sEmit, resultVar: sVar } = emitExpr(matchExpr.expr, module, ctx)
    if (matchExpr.clauses.length === 0) {
        return { emit: '', resultVar }
    }
    const clauses = matchExpr.clauses.map(clause => {
        if (clause.patterns.length !== 1) return jsError('union clause')
        const pattern = clause.patterns[0]
        const cond = emitPatternExprCondition(pattern.expr, module, ctx, sVar)
        const block = emitBlock(clause.block, module, ctx, resultVar)
        // TODO: inject aliases and fields in block's scope
        return emitLines([cond.emit, `if (${cond.resultVar}) ${block}`])
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
        emit: emitLines([jsVariable(resultVar), sEmit, ifElseChain]),
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
            return { emit: jsVariable(resultVar, jsError('literal')), resultVar }
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
        return jsError('destructuring')
    }
    return param.pattern.expr.value
}

export const emitPattern = (
    pattern: Pattern,
    module: Module,
    ctx: Context,
    assignVar: string,
    pub: boolean = false
): string => {
    if (pattern.expr.kind !== 'name') {
        return jsError('destructuring')
    }
    const name = pattern.expr.value
    return jsVariable(name, assignVar, pub)
}
