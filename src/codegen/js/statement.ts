import { emitUpcasts, jsRelName, jsString, nextVariable } from '.'
import { Module } from '../../ast'
import { Block, BreakStmt, FnDef, ImplDef, ReturnStmt, Statement, TraitDef, VarDef } from '../../ast/statement'
import { TypeDef, Variant } from '../../ast/type-def'
import { Context } from '../../scope'
import { typeDefToVirtualType } from '../../scope/trait'
import { vidToString } from '../../scope/util'
import { EmitExpr, emitExpr, emitParam, emitPattern } from './expr'
import { EmitNode, emitIntersperse, emitToken, emitTree, jsVariable } from './node'

export const emitStatement = (statement: Statement, module: Module, ctx: Context): EmitNode | EmitExpr => {
    switch (statement.kind) {
        case 'var-def':
            return emitVarDef(statement, module, ctx)
        case 'fn-def':
            return emitFnDef(statement, module, ctx) ?? emitToken('')
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

export const emitVarDef = (varDef: VarDef, module: Module, ctx: Context): EmitNode => {
    const { emit: exprEmit, resultVar } = emitExpr(varDef.expr!, module, ctx)
    return emitTree([exprEmit, emitPattern(varDef.pattern, module, ctx, resultVar, varDef.pub)])
}

export const emitFnDef = (fnDef: FnDef, module: Module, ctx: Context, asProperty = false): EmitNode | undefined => {
    if (!fnDef.block) return undefined
    const name = fnDef.name.value
    const params = fnDef.params.map(p => emitParam(p, module, ctx))
    const generics = fnDef.generics.map(g => emitToken(g.name.value, g.name.parseNode))
    const jsParams = emitIntersperse([...params, ...generics], ',')
    const block = emitBlock(fnDef.block, module, ctx, true)
    if (asProperty) {
        return emitTree([emitToken(`${name}: function(`), jsParams, emitToken(')'), block], fnDef.name.parseNode)
    } else {
        return emitTree(
            [emitToken(`${fnDef.pub ? 'export ' : ''}function ${name}(`), jsParams, emitToken(')'), block],
            fnDef.name.parseNode
        )
    }
}

export const emitInstanceDef = (instanceDef: ImplDef | TraitDef, module: Module, ctx: Context): EmitNode => {
    const rel = ctx.impls.find(i => i.instanceDef === instanceDef)!
    const superMethods = instanceDef.kind === 'impl-def' ? instanceDef.superMethods ?? [] : []
    const ms = superMethods.map(m => {
        const params = m.fn.params.map((p, i) => {
            const pVar = nextVariable(ctx)
            const upcastMap = m.paramUpcasts ? m.paramUpcasts[i] : undefined
            if (upcastMap) {
                return { emit: emitUpcasts(pVar, upcastMap), resultVar: pVar }
            } else {
                return { emit: emitToken(''), resultVar: pVar }
            }
        })
        const mName = m.fn.name.value
        const block = emitTree([
            emitToken('{'),
            ...params.map(p => p.emit),
            emitToken(`return ${jsRelName(m.rel)}().${mName}(${params.map(p => p.resultVar).join(',')})}`)
        ])
        return emitTree([emitToken(`${mName}:function(${params.map(p => p.resultVar).join(',')}) `), block])
    })
    const fns = instanceDef.block.statements
        .map(s => <FnDef>s)
        .map(f => emitFnDef(f, module, ctx, true))
        .filter(f => f)
        .map(f => f!)
    const all = [...ms, ...fns]
    const generics = instanceDef.generics.map(g => g.name.value)
    const cached = nextVariable(ctx)
    const fnEmit = emitTree([emitToken('{'), emitIntersperse(all, ','), emitToken('};')])
    const instanceEmit = emitTree([
        emitToken(`function(${generics.join(',')}){if(${cached}){return ${cached};}${cached}=`),
        fnEmit,
        emitToken(`return ${cached};}`)
    ])
    return emitTree([jsVariable(cached), jsVariable(jsRelName(rel), instanceEmit, true)])
}

export const emitTypeDef = (typeDef: TypeDef, module: Module, ctx: Context): EmitNode => {
    const name = typeDef.name.value
    const variants = typeDef.variants.map(v =>
        emitTree([emitToken(`${v.name.value}:`), emitVariant(v, typeDef, module, ctx)])
    )
    const items_ = emitIntersperse(variants, ',')
    const items = items_.nodes.length > 0 ? emitTree([emitToken('{'), items_, emitToken('}')]) : emitToken('{}')
    return jsVariable(name, items, true)
}

export const emitReturnStmt = (returnStmt: ReturnStmt, module: Module, ctx: Context): EmitNode => {
    const { emit: exprEmit, resultVar } = emitExpr(returnStmt.returnExpr, module, ctx)
    return emitTree([exprEmit, emitToken(`return ${resultVar};`)])
}

export const emitBreakStmt = (breakStmt: BreakStmt, module: Module, ctx: Context): EmitNode => {
    return emitToken('break;')
}

export const emitBlockStatements = (
    block: Block,
    module: Module,
    ctx: Context,
    resultVar?: boolean | string
): EmitNode[] => {
    const statements = block.statements.map(s => emitStatement(s, module, ctx))
    const last = statements.at(-1)
    if (resultVar !== undefined && last && 'resultVar' in last) {
        if (typeof resultVar === 'string') {
            statements.push(emitToken(`${resultVar} = ${last.resultVar};`))
        }
        if (resultVar === true) {
            statements.push(emitToken(`return ${last.resultVar};`))
        }
    }
    return statements.map(s => ('resultVar' in s ? s.emit : s))
}

export const emitBlock = (block: Block, module: Module, ctx: Context, resultVar?: boolean | string): EmitNode => {
    const statements = emitBlockStatements(block, module, ctx, resultVar)
    return emitTree([emitToken('{'), ...statements, emitToken('}')])
}

export const emitVariant = (v: Variant, typeDef: TypeDef, module: Module, ctx: Context): EmitNode => {
    const fieldNames = v.fieldDefs.map(f => f.name.value)
    const fields_ = fieldNames.map(f => `${f}`)
    const fields = fields_.length > 0 ? ` ${fields_.join(',')} ` : ''
    const type = jsString(vidToString(typeDefToVirtualType(typeDef, ctx, module).identifier))
    const name = jsString(v.name.value)
    const props = emitIntersperse(
        [
            emitToken(`$noisType:${type}`),
            emitToken(typeDef.variants.length > 1 ? `$noisVariant: ${name}` : ''),
            emitToken(`value:{${fields}}`),
            emitTree([emitToken(`upcast:`), emitUpcastFn(v, typeDef, module, ctx)])
        ],
        ','
    )
    return emitTree([emitToken(`function(${fieldNames.join(',')}) {`), emitToken('return{'), props, emitToken('}}')])
}

export const emitUpcastFn = (v: Variant, typeDef: TypeDef, module: Module, ctx: Context): EmitNode => {
    const params = ['value', 'Self', ...typeDef.generics.map(g => g.name.value)]
    const selfG = 'for(const [trait,impl] of Self){value[trait]=impl;}'
    return emitTree([emitToken(`function(${params.join(',')}) {`), emitToken(selfG), emitToken('}')])
}
