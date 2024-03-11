import {
    emitLines,
    emitVirtualTraits,
    extractValue,
    indent,
    jsError,
    jsRelName,
    jsString,
    jsVariable,
    nextVariable
} from '.'
import { Module, Param } from '../../ast'
import { BinaryExpr, Expr, OperandExpr, UnaryExpr } from '../../ast/expr'
import { MatchExpr, Pattern, PatternExpr } from '../../ast/match'
import { Operand } from '../../ast/operand'
import { Context } from '../../scope'
import { relTypeName } from '../../scope/trait'
import { operatorImplMap } from '../../semantic/op'
import { ConcreteGeneric } from '../../typecheck'
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
            const call = unaryExpr.op
            const args = call.args.map(a => {
                const { emit, resultVar: res } = emitExpr(a.expr, module, ctx)
                const argTraits = a.expr.traits
                const traitEmit = argTraits ? emitVirtualTraits(res, argTraits) : ''
                return { emit: emitLines([emit, traitEmit]), resultVar: res }
            })
            const genericTypes = call.generics?.map(g => emitGeneric(g, module, ctx)) ?? []
            const jsArgs = [...args, ...genericTypes]
            const traitEmit = unaryExpr.traits ? emitVirtualTraits(resultVar, unaryExpr.traits) : ''
            const variantDef = call.variantDef
            if (variantDef) {
                const variantName = `${variantDef.typeDef.name.value}.${variantDef.variant.name.value}`
                const call = jsVariable(resultVar, `${variantName}(${jsArgs.map(a => a.resultVar).join(', ')})`)
                return {
                    emit: emitLines([...jsArgs.map(a => a.emit), call, traitEmit]),
                    resultVar
                }
            } else {
                const operand = emitOperand(unaryExpr.operand, module, ctx)
                const call = jsVariable(resultVar, `${operand.resultVar}(${jsArgs.map(a => a.resultVar).join(', ')})`)
                return {
                    emit: emitLines([operand.emit, ...jsArgs.map(a => a.emit), call, traitEmit]),
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
    const rOp = emitOperand(binaryExpr.rOperand, module, ctx)
    switch (binaryExpr.binaryOp.kind) {
        case 'access-op': {
            if (binaryExpr.rOperand.kind === 'identifier') {
                const accessor = binaryExpr.rOperand.names.at(-1)!.value
                return {
                    emit: emitLines([lOp.emit, jsVariable(resultVar, `${lOp.resultVar}.value.${accessor}`)]),
                    resultVar
                }
            }
            if (binaryExpr.rOperand.kind === 'unary-expr' && binaryExpr.rOperand.op.kind === 'call-op') {
                const call = binaryExpr.rOperand.op
                const methodDef = call.methodDef!
                const methodName = methodDef.fn.name.value
                const args = call.args.map(a => emitExpr(a.expr, module, ctx))
                const genericTypes = call.generics?.map(g => emitGeneric(g, module, ctx)) ?? []
                const jsArgs = [...args, ...genericTypes]
                const argsEmit = (
                    methodDef.fn.static
                        ? jsArgs.map(a => a.resultVar)
                        : [lOp.resultVar, ...jsArgs.map(a => a.resultVar)]
                ).join(', ')
                const upcastRels = binaryExpr.lOperand.traits
                const upcastEmit = upcastRels
                    ? [...upcastRels.entries()].map(([name, rel]) => `${lOp.resultVar}.${name} = ${jsRelName(rel)}`)
                    : ''
                const callerEmit = call.impl ? jsRelName(call.impl) : `${lOp.resultVar}.${relTypeName(methodDef.rel)}`
                const callEmit = jsVariable(resultVar, `${callerEmit}().${methodName}(${argsEmit})`)
                return {
                    emit: emitLines([lOp.emit, ...upcastEmit, emitLines(jsArgs.map(a => a.emit)), callEmit]),
                    resultVar
                }
            }
            return {
                emit: jsError('unwrap/bind ops'),
                resultVar
            }
        }
        case 'assign-op': {
            // TODO: assign all js fields, including $noisType and impls
            return {
                emit: emitLines([
                    lOp.emit,
                    rOp.emit,
                    `${extractValue(lOp.resultVar)} = ${extractValue(rOp.resultVar)}`
                ]),
                resultVar
            }
        }
        default: {
            const op = binaryExpr.binaryOp
            const methodVid = operatorImplMap.get(op.kind)!
            const trait = methodVid.names.at(-2)!
            const method = methodVid.names.at(-1)!
            const callerEmit = binaryExpr.binaryOp.impl ? jsRelName(binaryExpr.binaryOp.impl) : trait
            const callEmit = jsVariable(resultVar, `${callerEmit}().${method}(${lOp.resultVar}, ${rOp.resultVar})`)
            return {
                emit: emitLines([lOp.emit, rOp.emit, callEmit]),
                resultVar
            }
        }
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
                    jsVariable(iteratorVar, `${expr.resultVar}.Iterable().iter(${expr.resultVar})`)
                ]),
                resultVar: iteratorVar
            }
            const iterateeVar = nextVariable(ctx)
            const thenBlock = emitLines([
                emitPattern(operand.pattern, module, ctx, `${iterateeVar}`),
                ...emitBlockStatements(operand.block, module, ctx)
            ])
            const block = emitLines([
                jsVariable(iterateeVar, `${iterator.resultVar}.Iter().next(${iterator.resultVar})`),
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
            const block = emitBlock(operand.block, module, ctx, true)
            return { emit: jsVariable(resultVar, `function(${params}) ${block}`), resultVar }
        }
        case 'operand-expr':
        case 'unary-expr':
        case 'binary-expr':
            return emitExpr(operand, module, ctx)
        case 'list-expr':
            const items = operand.exprs.map(e => emitExpr(e, module, ctx))
            return {
                emit: emitLines([
                    ...items.map(i => i.emit),
                    jsVariable(resultVar, `List.List([${items.map(i => i.resultVar).join(', ')}])`)
                ]),
                resultVar
            }
        case 'string-literal':
        case 'char-literal':
        case 'int-literal':
        case 'float-literal':
        case 'bool-literal':
            return emitLiteral(operand, module, ctx, resultVar)
        case 'identifier': {
            if (operand.ref?.def.kind === 'method-def') {
                if (operand.ref.def.fn.static === true) {
                    const typeName = operand.names.at(-2)!.value
                    const traitName = relTypeName(operand.ref.def.rel)
                    return {
                        emit: '',
                        resultVar: `${typeName}.${traitName}().${operand.ref.def.fn.name.value}`
                    }
                } else {
                    const arg = nextVariable(ctx)
                    const args = nextVariable(ctx)
                    const relName = jsRelName(operand.ref.def.rel)
                    const fnName = operand.ref.def.fn.name.value
                    return {
                        emit: '',
                        resultVar: `(function(${arg}, ...${args}) { return ${relName}().${fnName}(${arg}, ${args}); })`
                    }
                }
            }
            return { emit: '', resultVar: operand.names.at(-1)!.value }
        }
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
    return { emit: emitLines([jsVariable(resultVar, constructorEmit)]), resultVar }
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
        const block = emitLines([
            emitPattern(pattern, module, ctx, sVar),
            ...emitBlockStatements(clause.block, module, ctx, resultVar)
        ])
        return emitLines([cond.emit, `if (${cond.resultVar}) {\n${indent(block)}\n}`])
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
    switch (pattern.expr.kind) {
        case 'name':
            const name = pattern.expr.value
            return jsVariable(name, assignVar, pub)
        case 'con-pattern':
            const patterns = pattern.expr.fieldPatterns.flatMap(f => {
                const fieldAssign = f.name.value
                if (f.pattern) {
                    return [emitPattern(f.pattern, module, ctx, `${assignVar}.value.${fieldAssign}`)]
                }
                return jsVariable(fieldAssign, `${assignVar}.value.${fieldAssign}`)
            })
            return emitLines([...patterns])
        case 'list-expr':
        case 'string-literal':
        case 'char-literal':
        case 'int-literal':
        case 'float-literal':
        case 'bool-literal':
        case 'identifier':
            return jsError(pattern.expr.kind)
        case 'hole':
            return ''
        default:
            return unreachable()
    }
}

export const emitGeneric = (generic: ConcreteGeneric, module: Module, ctx: Context): EmitExpr => {
    const resultVar = nextVariable(ctx)
    // TODO: only insert bounded types
    const impls: string[] = []
    for (const impl of generic.impls) {
        impls.push(`${resultVar}.${relTypeName(impl)} = ${jsRelName(impl)};`)
    }
    return { emit: emitLines([jsVariable(resultVar, '{}'), ...impls]), resultVar }
}
