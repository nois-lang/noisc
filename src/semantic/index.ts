import { Context, findImpl, findImplFn, semanticError } from '../scope'
import { Module } from '../ast'
import { Block, FnDef, ImplDef, Statement, UseExpr, VarDef } from '../ast/statement'
import { BinaryExpr, UnaryExpr } from '../ast/expr'
import { operatorImplMap } from './op'
import { Identifier, Operand } from '../ast/operand'
import {
    anyType,
    isAssignable,
    typeError,
    typeParamToVirtual,
    typeToVirtual,
    unitType,
    VirtualFnType,
    VirtualGeneric,
    VirtualType,
    virtualTypeToString
} from '../typecheck'
import { CallOp } from '../ast/op'
import {
    idToVid,
    resolveVid,
    resolveVidMatched,
    statementToDefinition,
    statementVid,
    vidFromScope,
    vidFromString,
    vidToString
} from '../scope/vid'
import { flattenUseExpr, useExprToVid } from './use-expr'

export const checkModule = (module: Module, ctx: Context): void => {
    if (module.checked) return
    if (ctx.module) {
        throw Error('recursive module check')
    }

    ctx.module = module
    module.useExprs = module.useExprs.flatMap(useExpr => flattenUseExpr(useExpr))

    // TODO: check duplicate useExprs
    module.useExprs.forEach(e => checkUseExpr(e, ctx))
    checkBlock(module.block, ctx, true)

    ctx.module = undefined
    module.checked = true
}

const checkBlock = (block: Block, ctx: Context, topLevel: boolean = false): void => {
    ctx.module!.scopeStack.push({ statements: new Map() })
    if (topLevel) {
        block.statements.forEach(s => addDefToScope(ctx, s))
    }

    block.statements.forEach(s => checkStatement(s, ctx, topLevel))
    // TODO: block type

    ctx.module!.scopeStack.pop()
}

const checkUseExpr = (useExpr: UseExpr, ctx: Context): void => {
    ctx.module!.useExprs.forEach(expr => {
        const resolved = resolveVidMatched(useExprToVid(expr), ctx)
        if (!resolved) {
            ctx.errors.push(semanticError(ctx.module!, useExpr, 'unresolved use expression'))
        }
    })
}

const checkStatement = (statement: Statement, ctx: Context, topLevel: boolean = false): void => {
    const pushDefToStack = () => {
        if (!topLevel) {
            addDefToScope(ctx, statement)
        }
    }

    switch (statement.kind) {
        case 'var-def':
            checkVarDef(statement, ctx)
            break
        case 'fn-def':
            checkFnDef(statement, ctx)
            pushDefToStack()
            break
        case 'kind-def':
            // todo
            pushDefToStack()
            break
        case 'impl-def':
            // todo
            pushDefToStack()
            break
        case 'type-def':
            // todo
            pushDefToStack()
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
    if (!fnDef.block) {
        if (!ctx.module!.kindDef) {
            ctx.warnings.push(semanticError(ctx.module!, fnDef, 'missing function body, must be a native function'))
        }
    } else {
        checkBlock(fnDef.block, ctx)
    }
}

const checkVarDef = (varDef: VarDef, ctx: Context): void => {
    // todo
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

    // TODO: remove
    if (!operand.type) return
    if (operand.type!.kind !== 'fn-type') {
        const message = `type error: non-callable operand of type ${virtualTypeToString(operand.type!)}`
        ctx.errors.push(semanticError(ctx.module!, operand, message))
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
        ctx.errors.push(typeError(ctx.module!, unaryExpr, operand.type, t))
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
${virtualTypeToString(binaryExpr.rOperand.type!)})`
        ctx.errors.push(semanticError(ctx.module!, binaryExpr.binaryOp, message))
        return
    }

    const implFn = findImplFn(impl, opImplFnId, ctx)
    if (!implFn) throw Error('impl fn not found')
    if (!implFn.type) throw Error('untyped impl fn')

    const t: VirtualFnType = {
        kind: 'fn-type',
        generics: [],
        paramTypes: [binaryExpr.lOperand, binaryExpr.rOperand].map(o => o.type!),
        returnType: anyType
    }
    if (!isAssignable(t, implFn.type, ctx)) {
        ctx.errors.push(typeError(ctx.module!, binaryExpr, implFn.type, t))
        return
    }
}

const checkImplDef = (implDef: ImplDef, ctx: Context): void => {
    if (ctx.module!.implDef) {
        ctx.errors.push(semanticError(ctx.module!, implDef, 'nested impl definition'))
        return
    }
    ctx.module!.implDef = implDef
    implDef.block.statements.forEach(s => {
        checkStatement(s, ctx)
    })
    ctx.module!.implDef = undefined
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
            checkIdentifier(operand, ctx)
            break
    }
}

const checkIdentifier = (identifier: Identifier, ctx: Context): void => {
    const vid = idToVid(identifier)
    const ref = resolveVid(vid, ctx)
    if (!ref) {
        ctx.errors.push(semanticError(ctx.module!, identifier, `identifier ${vidToString(vid)} not found`))
    }
}

const addDefToScope = (ctx: Context, statement: Statement): void => {
    const vid = statementVid(statement)
    if (!vid) return

    const def = statementToDefinition(statement)
    if (!def) return

    ctx.module!.scopeStack.at(-1)!.statements.set(vidToString(vid), def)
}

