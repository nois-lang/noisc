import { Context, findImpl, findImplFn } from '../scope'
import { Module } from '../ast'
import { Block, FnDef, ImplDef, Statement, UseExpr } from '../ast/statement'
import { BinaryExpr, UnaryExpr } from '../ast/expr'
import { operatorImplMap } from './op'
import { Operand } from '../ast/operand'
import {
    anyType,
    isAssignable,
    typeParamToVirtual,
    typeToVirtual,
    unitType,
    VirtualFnType,
    VirtualGeneric,
    VirtualType,
    virtualTypeToString
} from '../typecheck'
import { CallOp } from '../ast/op'
import { vidFromScope, vidFromString, vidToString } from '../scope/vid'
import { flattenUseExpr } from './use-expr'

export const checkModule = (module: Module, ctx: Context): void => {
    if (module.checked) return
    if (ctx.module && vidToString(ctx.module.identifier) === vidToString(module.identifier)) {
        ctx.errors.push({ node: module, message: 'recursive module resolution' })
        return
    }

    ctx.module = module

    // TODO: check duplicate exprs
    module.useExprs.forEach(e => checkUseExpr(e, ctx))
    checkBlock(module.block, ctx, true)

    ctx.module = undefined
    module.checked = true
}

export const checkBlock = (block: Block, ctx: Context, topLevel: boolean = false): void => {
    ctx.scopeStack.push({ statements: [] })
    if (topLevel) {
        ctx.scopeStack.at(-1)!.statements.push(...block.statements)
    }

    block.statements.forEach(s => checkStatement(s, ctx, topLevel))
    // TODO: block type

    ctx.scopeStack.pop()
}

const checkUseExpr = (useExpr: UseExpr, ctx: Context): void => {
    const useExprs = flattenUseExpr(useExpr)
    useExprs.forEach(expr => {
        // TODO: check if such vid exist
    })
}

const checkStatement = (statement: Statement, ctx: Context, topLevel: boolean = false): void => {
    if (topLevel && ['return-stmt', 'operand-expr', 'unary-expr', 'binary-expr'].includes(statement.kind)) {
        ctx.errors.push({ node: statement, message: `top level \`${statement.kind}\` is not allowed` })
        return
    }
    const push = () => {
        if (!topLevel) {
            ctx.scopeStack.at(-1)!.statements.push(statement)
        }
    }

    switch (statement.kind) {
        case 'var-def':
            // todo
            break
        case 'fn-def':
            checkFnDef(statement, ctx)
            push()
            break
        case 'kind-def':
            // todo
            push()
            break
        case 'impl-def':
            // todo
            push()
            break
        case 'type-def':
            // todo
            push()
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
            if (ctx.implDef
                && i === 0
                && p.pattern.kind === 'operand-expr'
                && p.pattern.operand.kind === 'identifier'
                && p.pattern.operand.name.value === 'self') {
                generics.unshift({ name: 'Self', bounds: [] })
                return { kind: 'variant-type', identifier: vidFromString('Self'), typeParams: [] }
            } else {
                ctx.errors.push({ node: p, message: 'parameter type not specified' })
                return { kind: 'any-type' }
            }
        } else {
            return typeToVirtual(p.paramType)
        }
    })
    fnDef.type = {
        kind: 'fn-type',
        generics: generics,
        paramTypes,
        returnType: fnDef.returnType ? typeToVirtual(fnDef.returnType) : unitType
    }
    if (!fnDef.block) {
        if (!ctx.kindDef) {
        }
    } else {
        checkBlock(fnDef.block, ctx)
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
    checkOperand(operand, ctx)

    if (operand.type!.kind !== 'fn-type') {
        const message = `type error: non-callable operand of type ${virtualTypeToString(operand.type!)}`
        ctx.errors.push({ node: operand, message })
        return
    }
    callOp.args.forEach(a => checkOperand(a, ctx))
    const t: VirtualFnType = {
        kind: 'fn-type',
        generics: [],
        paramTypes: callOp.args.map(a => a.type!),
        returnType: anyType
    }
    if (!isAssignable(t, operand.type!, ctx)) {
        const message = `\
type error: expected ${virtualTypeToString(operand.type!)}
            got      ${virtualTypeToString(t)}`
        ctx.errors.push({ node: unaryExpr, message })
        return
    }
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
            operand.type = { kind: 'variant-type', identifier: vidFromString('std::String'), typeParams: [] }
            break
        case 'char-literal':
            operand.type = { kind: 'variant-type', identifier: vidFromString('std::Char'), typeParams: [] }
            break
        case 'int-literal':
            operand.type = { kind: 'variant-type', identifier: vidFromString('std::Int'), typeParams: [] }
            break
        case 'float-literal':
            operand.type = { kind: 'variant-type', identifier: vidFromString('std::Float'), typeParams: [] }
            break
        case 'identifier':
            // todo
            break
    }
}
