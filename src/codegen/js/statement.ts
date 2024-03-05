import { indent, jsRelName, jsString, jsVariable } from '.'
import { Module } from '../../ast'
import { Block, BreakStmt, FnDef, ImplDef, ReturnStmt, Statement, TraitDef, VarDef } from '../../ast/statement'
import { TypeDef, Variant } from '../../ast/type-def'
import { Context } from '../../scope'
import { typeDefToVirtualType } from '../../scope/trait'
import { vidToString } from '../../scope/util'
import { todo } from '../../util/todo'
import { EmitExpr, emitExpr, emitExprToString, emitParam } from './expr'

export const emitStatement = (statement: Statement, module: Module, ctx: Context): string | EmitExpr => {
    switch (statement.kind) {
        case 'var-def':
            return emitVarDef(statement, module, ctx)
        case 'fn-def':
            return emitFnDef(statement, module, ctx)
        case 'trait-def':
        case 'impl-def':
            return emitInstanceDef(statement, module, ctx)
        case 'type-def':
            return emitTypeDef(statement, module, ctx)
        case 'return-stmt':
            return emitReturnStmt(statement, module, ctx)
        case 'break-stmt':
            return emitBreakStmt(statement, module, ctx)
        case 'operand-expr':
        case 'unary-expr':
        case 'binary-expr':
            return emitExpr(statement, module, ctx)
    }
}

export const emitVarDef = (varDef: VarDef, module: Module, ctx: Context): string => {
    if (varDef.pattern.expr.kind !== 'name') {
        return todo('destructuring')
    }
    const name = varDef.pattern.expr.value
    const { emit: exprEmit, resultVar } = emitExpr(varDef.expr!, module, ctx)
    return [exprEmit, jsVariable(name, resultVar, varDef.pub)].join('\n')
}

export const emitFnDef = (fnDef: FnDef, module: Module, ctx: Context, asProperty = false): string => {
    if (!fnDef.block) return ''
    const name = fnDef.name.value
    const params = fnDef.params.map(p => emitParam(p, module, ctx)).join(', ')
    const block = emitBlock(fnDef.block, module, ctx, true)
    if (asProperty) {
        return `${name}: function(${params}) ${block}`
    } else {
        return `${fnDef.pub ? 'export ' : ''}function ${name}(${params}) ${block}`
    }
}

export const emitInstanceDef = (instanceDef: ImplDef | TraitDef, module: Module, ctx: Context): string => {
    const rel = ctx.impls.find(i => i.instanceDef === instanceDef)!
    const impl = emitInstance(instanceDef, module, ctx)
    return jsVariable(jsRelName(rel), impl, true)
}

export const emitTypeDef = (typeDef: TypeDef, module: Module, ctx: Context): string => {
    const name = typeDef.name.value
    const variants = typeDef.variants.map(v => indent(`${v.name.value}: ${emitVariant(v, typeDef, module, ctx)}`))
    const impl = typeDef.rel ? indent(`${name}: ${emitInstance(typeDef.rel.instanceDef, module, ctx)}`) : ''
    const items_ = [...variants, impl].filter(i => i.length > 0).join(',\n')
    const items = items_.length > 0 ? `{\n${items_}\n}` : '{}'
    return jsVariable(name, items, true)
}

export const emitReturnStmt = (returnStmt: ReturnStmt, module: Module, ctx: Context): string => {
    const { emit: exprEmit, resultVar } = emitExpr(returnStmt.returnExpr, module, ctx)
    return [exprEmit, `return ${resultVar};`].join('\n')
}

export const emitBreakStmt = (breakStmt: BreakStmt, module: Module, ctx: Context): string => {
    return 'break;'
}

export const emitInstance = (instance: ImplDef | TraitDef, module: Module, ctx: Context): string => {
    const fns_ = instance.block.statements
        .map(s => <FnDef>s)
        .map(f => emitFnDef(f, module, ctx, true))
        .filter(f => f.length > 0)
        .map(f => indent(f))
    const fns = fns_.length > 0 ? `\n${fns_.join(',\n')}\n` : ''
    return `{${fns}}`
}

export const emitBlockStatements = (
    block: Block,
    module: Module,
    ctx: Context,
    resultVar?: boolean | string
): string[] => {
    const statements = block.statements.map(s => emitStatement(s, module, ctx))
    const last = statements.at(-1)
    if (resultVar !== undefined && typeof last === 'object') {
        if (typeof resultVar === 'string') {
            statements.push(`${resultVar} = ${last.resultVar};`)
        }
        if (resultVar === true) {
            statements.push(`return ${last.resultVar};`)
        }
    }
    return statements.map(emitExprToString)
}

export const emitBlock = (block: Block, module: Module, ctx: Context, resultVar?: boolean | string): string => {
    const statements_ = emitBlockStatements(block, module, ctx, resultVar)
    const statements = statements_.length > 0 ? `\n${indent(statements_.join('\n'))}\n` : ''
    return `{${statements}}`
}

export const emitVariant = (v: Variant, typeDef: TypeDef, module: Module, ctx: Context) => {
    const fieldNames = v.fieldDefs.map(f => f.name.value)
    const fields = fieldNames.map(f => `${f}`)
    const type = jsString(vidToString(typeDefToVirtualType(typeDef, ctx, module).identifier))
    const name = jsString(v.name.value)
    const props = [
        `$noisType: ${type}`,
        ...(typeDef.variants.length > 1 ? [`$noisVariant: ${name}`] : []),
        ...fields
    ].join(', ')
    return `function(${fieldNames.join(', ')}) {\n${indent(`return { ${props} }`)}\n}`
}
