import { emitUpcasts, extractValue, jsRelName, jsString, nextVariable } from '.'
import { Module, Param } from '../../ast'
import { BinaryExpr, Expr, OperandExpr, UnaryExpr } from '../../ast/expr'
import { MatchExpr, Pattern, PatternExpr } from '../../ast/match'
import { Operand } from '../../ast/operand'
import { Context } from '../../scope'
import { relTypeName } from '../../scope/trait'
import { operatorImplMap } from '../../semantic/op'
import { ConcreteGeneric } from '../../typecheck'
import { unreachable } from '../../util/todo'
import { EmitNode, EmitToken, emitToken, emitTree, jsError, jsVariable } from './node'
import { emitBlock, emitBlockStatements } from './statement'

export interface EmitExpr {
    emit: EmitNode
    resultVar: string
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
    const operand = emitOperand(operandExpr.operand, module, ctx)
    const upcastEmit = emitUpcasts(operand.resultVar, operandExpr.upcasts)
    return { emit: emitTree([operand.emit, upcastEmit]), resultVar: operand.resultVar }
}

export const emitUnaryExpr = (unaryExpr: UnaryExpr, module: Module, ctx: Context): EmitExpr => {
    const resultVar = nextVariable(ctx)
    const upcasts = unaryExpr.operand.upcasts
    switch (unaryExpr.op.kind) {
        case 'method-call-op': {
            const lOp = emitOperand(unaryExpr.operand, module, ctx)
            const mCall = unaryExpr.op
            const call = mCall.call
            const methodDef = call.methodDef!
            const methodName = methodDef.fn.name.value

            const args = call.args.map(a => emitExpr(a.expr, module, ctx))
            const genericTypes = call.generics?.map(g => emitGeneric(g, module, ctx)) ?? []
            const jsArgs = [...args, ...genericTypes]
            const argsEmit = (
                methodDef.fn.static ? jsArgs.map(a => a.resultVar) : [lOp.resultVar, ...jsArgs.map(a => a.resultVar)]
            ).join(',')

            const upcastEmit = emitUpcasts(lOp.resultVar, upcasts)

            const callerEmit = call.impl ? jsRelName(call.impl) : `${lOp.resultVar}.${relTypeName(methodDef.rel)}`
            const callEmit = jsVariable(resultVar, emitToken(`${callerEmit}().${methodName}(${argsEmit})`))

            const exprUpcastEmit = emitUpcasts(resultVar, unaryExpr.upcasts)
            return {
                emit: emitTree(
                    [lOp.emit, emitTree(jsArgs.map(a => a.emit)), upcastEmit, callEmit, exprUpcastEmit],
                    mCall.name.parseNode
                ),
                resultVar
            }
        }
        case 'field-access-op': {
            const lOp = emitOperand(unaryExpr.operand, module, ctx)
            const upcastEmit = emitUpcasts(lOp.resultVar, upcasts)
            return {
                emit: emitTree([
                    lOp.emit,
                    upcastEmit,
                    jsVariable(resultVar, emitToken(`${lOp.resultVar}.value.${unaryExpr.op.name.value}`))
                ]),
                resultVar
            }
        }
        case 'call-op':
            const call = unaryExpr.op
            const args = call.args.map(a => {
                const { emit, resultVar: res } = emitExpr(a.expr, module, ctx)
                const upcastEmit = emitUpcasts(res, a.expr.upcasts)
                return { emit: emitTree([emit, upcastEmit]), resultVar: res }
            })
            const genericTypes = call.generics?.map(g => emitGeneric(g, module, ctx)) ?? []
            const jsArgs = [...args, ...genericTypes]
            const upcastEmit = emitUpcasts(resultVar, unaryExpr.upcasts)
            const variantDef = call.variantDef
            const parseNode = unaryExpr.operand.kind === 'identifier' ? unaryExpr.operand.parseNode : call.parseNode
            if (variantDef) {
                const variantName = `${variantDef.typeDef.name.value}.${variantDef.variant.name.value}`
                const callEmit = jsVariable(
                    resultVar,
                    emitToken(`${variantName}(${jsArgs.map(a => a.resultVar).join(',')})`)
                )
                return {
                    emit: emitTree([...jsArgs.map(a => a.emit), callEmit, upcastEmit], parseNode),
                    resultVar
                }
            } else {
                const operand = emitOperand(unaryExpr.operand, module, ctx)
                const callEmit = jsVariable(
                    resultVar,
                    emitToken(`${operand.resultVar}(${jsArgs.map(a => a.resultVar).join(',')})`, parseNode)
                )
                return {
                    emit: emitTree([operand.emit, ...jsArgs.map(a => a.emit), callEmit, upcastEmit]),
                    resultVar
                }
            }
        case 'unwrap-op': {
            const operand = emitOperand(unaryExpr.operand, module, ctx)
            const upcastEmit = emitUpcasts(operand.resultVar, upcasts)
            return {
                emit: emitTree([
                    operand.emit,
                    upcastEmit,
                    jsVariable(resultVar, emitToken(`${operand.resultVar}.Unwrap().unwrap(${operand.resultVar})`))
                ]),
                resultVar
            }
        }
        case 'bind-op': {
            const operand = emitOperand(unaryExpr.operand, module, ctx)
            const upcastEmit = emitUpcasts(operand.resultVar, upcasts)
            const bindVar = nextVariable(ctx)
            return {
                emit: emitTree([
                    operand.emit,
                    upcastEmit,
                    jsVariable(bindVar, emitToken(`${operand.resultVar}.Unwrap().bind(${operand.resultVar})`)),
                    emitToken(`if(${bindVar}.$noisVariant==="None"){return ${bindVar}}`),
                    jsVariable(resultVar, emitToken(`${operand.resultVar}.Unwrap().unwrap(${operand.resultVar})`))
                ]),
                resultVar
            }
        }
    }
}

export const emitBinaryExpr = (binaryExpr: BinaryExpr, module: Module, ctx: Context): EmitExpr => {
    const lOp = emitOperand(binaryExpr.lOperand, module, ctx)
    const resultVar = nextVariable(ctx)
    const rOp = emitOperand(binaryExpr.rOperand, module, ctx)
    switch (binaryExpr.binaryOp.kind) {
        case 'assign-op': {
            return {
                emit: emitTree([
                    lOp.emit,
                    rOp.emit,
                    emitToken(`${extractValue(lOp.resultVar)}=${extractValue(rOp.resultVar)};`),
                    emitToken(`${lOp.resultVar}.$noisType=${rOp.resultVar}.$noisType;`),
                    emitToken(`${lOp.resultVar}.$noisVariant=${rOp.resultVar}.$noisVariant;`)
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
            const callEmit = jsVariable(
                resultVar,
                emitToken(`${callerEmit}().${method}(${lOp.resultVar}, ${rOp.resultVar})`)
            )
            return {
                emit: emitTree([lOp.emit, rOp.emit, callEmit]),
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
            const elseBlock = operand.elseBlock
                ? emitTree([emitToken('else'), emitBlock(operand.elseBlock, module, ctx, resultVar)])
                : emitToken('')
            return {
                emit: emitTree([
                    jsVariable(resultVar),
                    cEmit,
                    emitToken(`if(${extractValue(cVar)})`),
                    thenBlock,
                    elseBlock
                ]),
                resultVar
            }
        }
        case 'if-let-expr':
            return { emit: jsError('if-let'), resultVar }
        case 'while-expr': {
            const { emit: cEmit, resultVar: cVar } = emitExpr(operand.condition, module, ctx)
            const { emit: cEndEmit, resultVar: cEndVar } = emitExpr(operand.condition, module, ctx)
            return {
                emit: emitTree([
                    cEmit,
                    emitToken(`while (${extractValue(cVar)}) {`),
                    ...emitBlockStatements(operand.block, module, ctx),
                    cEndEmit,
                    emitToken(`${cVar}=${cEndVar};`),
                    emitToken('}')
                ]),
                resultVar
            }
        }
        case 'for-expr': {
            const expr = emitExpr(operand.expr, module, ctx)
            const iteratorVar = nextVariable(ctx)
            const upcastsEmit = emitUpcasts(expr.resultVar, operand.expr.upcasts)
            const iterator = {
                emit: emitTree([
                    expr.emit,
                    upcastsEmit,
                    // TODO: do not invoke `iter` if it is already Iter
                    jsVariable(iteratorVar, emitToken(`${expr.resultVar}.Iterable().iter(${expr.resultVar});`))
                ]),
                resultVar: iteratorVar
            }
            const iterateeVarOption = nextVariable(ctx)
            const iterateeVar = nextVariable(ctx)
            const thenBlock = emitTree([
                jsVariable(iterateeVar, emitToken(`${extractValue(iterateeVarOption)}.value;`)),
                emitPattern(operand.pattern, module, ctx, `${iterateeVar}`),
                ...emitBlockStatements(operand.block, module, ctx)
            ])
            const block = emitTree([
                jsVariable(iterateeVarOption, emitToken(`${iterator.resultVar}.Iter().next(${iterator.resultVar})`)),
                emitToken(`if(${iterateeVarOption}.$noisVariant==="Some"){`),
                thenBlock,
                emitToken(`}else{break;}`)
            ])
            const forEmit = emitTree([iterator.emit, emitToken('while(true){'), block, emitToken('}')])
            return { emit: emitTree([jsVariable(resultVar), forEmit]), resultVar }
        }
        case 'match-expr':
            return emitMatchExpr(operand, module, ctx, resultVar)
        case 'closure-expr': {
            const params = operand.params.map(p => emitParam(p, module, ctx))
            const statements = emitBlockStatements(operand.block, module, ctx, true)
            const block = emitTree([emitToken('{'), ...params.map(p => p.emit), ...statements, emitToken('}')])
            return {
                emit: jsVariable(
                    resultVar,
                    emitTree([emitToken(`function(${params.map(p => p.resultVar).join(',')})`), block])
                ),
                resultVar
            }
        }
        case 'operand-expr':
        case 'unary-expr':
        case 'binary-expr':
            return emitExpr(operand, module, ctx)
        case 'list-expr':
            const items = operand.exprs.map(e => emitExpr(e, module, ctx))
            return {
                emit: emitTree([
                    ...items.map(i => i.emit),
                    jsVariable(resultVar, emitToken(`List.List([${items.map(i => i.resultVar).join(',')}])`))
                ]),
                resultVar
            }
        case 'string-literal':
        case 'char-literal':
        case 'int-literal':
        case 'float-literal':
        case 'bool-literal':
            return emitLiteral(operand, module, ctx, resultVar)
        case 'string-interpolated':
            const ts: EmitExpr[] = operand.tokens.map(t => {
                if (typeof t === 'string') {
                    return { emit: emitToken(''), resultVar: `"${t}"` }
                } else {
                    const exprEmit = emitExpr(t, module, ctx)
                    return {
                        emit: exprEmit.emit,
                        resultVar: extractValue(`${exprEmit.resultVar}.Show().show(${exprEmit.resultVar})`)
                    }
                }
            })
            const concatEmit = jsVariable(
                resultVar,
                emitTree([emitToken('String.String('), emitToken(ts.map(t => t.resultVar).join('+')), emitToken(')')])
            )
            return { emit: emitTree([...ts.map(t => t.emit), concatEmit]), resultVar }
        case 'identifier': {
            if (operand.ref?.def.kind === 'method-def') {
                if (operand.ref.def.fn.static === true) {
                    const typeName = operand.names.at(-2)!.value
                    const traitName = relTypeName(operand.ref.def.rel)
                    return {
                        emit: emitToken(''),
                        resultVar: `${typeName}.${traitName}().${operand.ref.def.fn.name.value}`
                    }
                } else {
                    const args = operand.ref.def.fn.params.map((_, i) => {
                        const v = nextVariable(ctx)
                        const upcast = operand.upcastFn?.paramUpcasts.at(i)
                        return { emit: upcast ? emitUpcasts(v, [upcast]) : emitToken(''), resultVar: v }
                    })
                    const relName = jsRelName(operand.ref.def.rel)
                    const fnName = operand.ref.def.fn.name.value
                    // TODO: this is probably wrong
                    const callerEmit =
                        operand.impl && operand.impl.instanceDef.kind === 'impl-def'
                            ? jsRelName(operand.impl)
                            : `${args[0].resultVar}.${relName}`
                    const delegate = `return ${callerEmit}().${fnName}(${args.map(a => a.resultVar)});`
                    const block = `${args.map(a => (<EmitToken>a.emit).value)}${delegate}`
                    return {
                        emit: emitToken(''),
                        resultVar: `(function(${args.map(a => a.resultVar)}){${block}})`
                    }
                }
            }
            const resultVar = operand.names.at(-1)!.value
            const upcastEmit = emitUpcasts(resultVar, operand.upcasts)
            return { emit: emitTree([upcastEmit]), resultVar }
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
    return { emit: emitTree([jsVariable(resultVar, emitToken(constructorEmit))]), resultVar }
}

export const emitMatchExpr = (matchExpr: MatchExpr, module: Module, ctx: Context, resultVar: string): EmitExpr => {
    const { emit: sEmit, resultVar: sVar } = emitExpr(matchExpr.expr, module, ctx)
    if (matchExpr.clauses.length === 0) {
        return { emit: emitToken(''), resultVar }
    }
    const clauses = matchExpr.clauses.map(clause => {
        if (clause.patterns.length !== 1) return jsError('union clause')
        const pattern = clause.patterns[0]
        const cond = emitPatternExprCondition(pattern.expr, module, ctx, sVar)
        const block = emitTree([
            emitPattern(pattern, module, ctx, sVar),
            ...emitBlockStatements(clause.block, module, ctx, resultVar)
        ])
        return emitTree([cond.emit, emitTree([emitToken(`if(${cond.resultVar}){`), block, emitToken('}')])])
    })
    let ifElseChain = clauses[0]
    for (let i = 1; i < clauses.length; i++) {
        const clause = clauses[i]
        ifElseChain = emitTree([ifElseChain, emitToken(`else{`), clause])
    }
    for (let i = clauses.length - 2; i >= 0; i--) {
        ifElseChain = emitTree([ifElseChain, emitToken('}')])
    }
    return {
        emit: emitTree([jsVariable(resultVar), sEmit, ifElseChain]),
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
            const cond = emitToken(`${sVar}.$noisVariant===${jsString(variantName)}`, patternExpr.identifier.parseNode)
            // TODO: nested patterns
            return { emit: jsVariable(resultVar, cond), resultVar }
        case 'hole':
            return { emit: jsVariable(resultVar, emitToken('true')), resultVar }
        case 'string-literal':
        case 'char-literal':
        case 'int-literal':
        case 'float-literal':
        case 'bool-literal':
            return { emit: jsVariable(resultVar, jsError('literal')), resultVar }
        case 'string-interpolated':
            return { emit: jsVariable(resultVar, jsError('string-interpolated')), resultVar }
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

export const emitParam = (param: Param, module: Module, ctx: Context): EmitExpr => {
    return emitDestructurePattern(param.pattern, module, ctx)
}

export const emitDestructurePattern = (pattern: Pattern, module: Module, ctx: Context): EmitExpr => {
    switch (pattern.expr.kind) {
        case 'name':
            return { emit: emitToken(''), resultVar: pattern.expr.value }
        case 'hole':
            return { emit: emitToken(''), resultVar: nextVariable(ctx) }
        case 'con-pattern':
            const paramVar = nextVariable(ctx)
            const fields = pattern.expr.fieldPatterns.map(f => {
                if (f.pattern) {
                    const inner = emitDestructurePattern(f.pattern, module, ctx)
                    return emitTree([
                        jsVariable(inner.resultVar, emitToken(`${extractValue(paramVar)}.${f.name.value}`)),
                        inner.emit
                    ])
                }
                return jsVariable(f.name.value, emitToken(`${extractValue(paramVar)}.${f.name.value}`))
            })
            return { emit: emitTree(fields), resultVar: paramVar }
        default:
            return unreachable()
    }
}

export const emitPattern = (
    pattern: Pattern,
    module: Module,
    ctx: Context,
    assignVar: string,
    pub: boolean = false
): EmitNode => {
    switch (pattern.expr.kind) {
        case 'name':
            const name = pattern.expr.value
            return jsVariable(name, emitToken(assignVar), pub)
        case 'con-pattern':
            const patterns = pattern.expr.fieldPatterns.map(f => {
                const fieldAssign = f.name.value
                if (f.pattern) {
                    return emitPattern(f.pattern, module, ctx, `${assignVar}.value.${fieldAssign}`)
                }
                return jsVariable(fieldAssign, emitToken(`${assignVar}.value.${fieldAssign}`))
            })
            return emitTree([...patterns])
        case 'list-expr':
        case 'string-literal':
        case 'char-literal':
        case 'int-literal':
        case 'float-literal':
        case 'bool-literal':
        case 'identifier':
            return jsError(pattern.expr.kind)
        case 'hole':
            return emitToken('')
        default:
            return unreachable()
    }
}

export const emitGeneric = (generic: ConcreteGeneric, module: Module, ctx: Context): EmitExpr => {
    const resultVar = nextVariable(ctx)
    // TODO: only insert bounded types
    const impls: EmitNode[] = []
    for (const impl of generic.impls) {
        impls.push(emitToken(`${resultVar}.${relTypeName(impl)} = ${jsRelName(impl)};`))
    }
    return { emit: emitTree([jsVariable(resultVar, emitToken('{}')), ...impls]), resultVar }
}
