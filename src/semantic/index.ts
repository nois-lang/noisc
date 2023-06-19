import { Context, findImpl, findImplFn, vidFromScope, vidToString } from '../scope'
import { AstNode, Module } from '../ast'
import { FnDef, ImplDef, Statement, UseExpr } from '../ast/statement'
import { BinaryExpr, UnaryExpr } from '../ast/expr'
import { operatorImplMap } from './op'
import { Operand } from '../ast/operand'
import {
    anyType,
    isAssignable,
    typeParamToVirtual,
    typeToVirtual,
    VirtualFnType,
    VirtualGeneric,
    VirtualType,
    virtualTypeToString
} from '../typecheck'
import { CallOp } from '../ast/op'
import { todo } from '../util/todo'

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
            checkFnDef(statement, ctx)
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

const checkFnDef = (fnDef: FnDef, ctx: Context): void => {
    const unexpectedVariantType = fnDef.typeParams.find(tp => tp.kind === 'variant-type')
    if (unexpectedVariantType) {
        ctx.errors.push({ node: unexpectedVariantType, message: 'expected generic, got variant type' })
        return
    }
    const generics = fnDef.typeParams.map(tp => <VirtualGeneric>typeParamToVirtual(tp))
    const paramTypes: VirtualType[] = fnDef.params.map((p, i) => {
        if (!p.paramType) {
            if (i === 0
                && p.pattern.kind === 'operand-expr'
                && p.pattern.operand.kind === 'identifier'
                && p.pattern.operand.name.value === 'self') {
                generics.unshift({ name: 'Self', bounds: [] })
                return { kind: 'variant-type', identifier: { scope: [], name: 'Self' }, typeParams: [] }
            } else {
                ctx.errors.push({ node: p, message: 'parameter type not specified' })
                return { kind: 'any-type' }
            }
        } else {
            return typeToVirtual(p.paramType)
        }
    })
    const returnType = fnDef.returnType ? typeToVirtual(fnDef.returnType) : todo('infer fn return type')
    fnDef.type = {
        kind: 'fn-type',
        generics: generics,
        paramTypes,
        returnType
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

    const opImplFnId = operatorImplMap.get(binaryExpr.binaryOp.kind)
    if (!opImplFnId) return

    const opImplId = vidFromScope(opImplFnId)
    const impl = findImpl(opImplId, binaryExpr.lOperand.type!, ctx)
    if (!impl) {
        const message = `no suitable impl \
${vidToString(opImplId)}(\
${virtualTypeToString(binaryExpr.lOperand.type!)}, \
${virtualTypeToString(binaryExpr.rOperand.type!)})}`
        ctx.errors.push({ node: binaryExpr.binaryOp, message: message })
        return
    }

    checkImplDef(impl, ctx)

    const implFn = findImplFn(impl, opImplFnId, ctx)!
    const t: VirtualFnType = {
        kind: 'fn-type',
        generics: [],
        paramTypes: [binaryExpr.lOperand, binaryExpr.rOperand].map(o => o.type!),
        returnType: anyType
    }
    if (!isAssignable(t, implFn.type!, ctx)) {
        const message = `\
type error: expected ${virtualTypeToString(implFn.type!)}
            got      ${virtualTypeToString(t)}`
        ctx.errors.push({ node: binaryExpr, message })
        return
    }
}

const checkImplDef = (implDef: ImplDef, ctx: Context): void => {
    ctx.implDef = implDef
    implDef.block.statements.forEach(s => {
        checkStatement(s, ctx)
    })
    ctx.implDef = undefined
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
