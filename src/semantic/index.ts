import { Context, findImpl, findImplFn, instanceScope } from '../scope'
import { Module, Param } from '../ast'
import { Block, FnDef, ImplDef, KindDef, Statement, VarDef } from '../ast/statement'
import { BinaryExpr, Expr, UnaryExpr } from '../ast/expr'
import { operatorImplMap } from './op'
import { Identifier, Operand } from '../ast/operand'
import {
    anyType,
    genericToVirtual,
    isAssignable,
    selfType,
    typeError,
    typeToVirtual,
    unitType,
    unknownType,
    VirtualFnType,
    virtualTypeToString
} from '../typecheck'
import { CallOp } from '../ast/op'
import {
    idToVid,
    resolveVid,
    statementToDefinition,
    statementVid,
    vidFromScope,
    vidFromString,
    vidToString
} from '../scope/vid'
import { useExprToVids } from './use-expr'
import { Type } from '../ast/type'
import { notFoundError, semanticError } from './error'
import { todo } from '../util/todo'

export const checkModule = (module: Module, ctx: Context, brief: boolean = false): void => {
    const vid = vidToString(module.identifier)
    if (ctx.moduleStack.some(m => vidToString(m.identifier) === vid)) {
        const stackVids = ctx.moduleStack.map(m => vidToString(m.identifier))
        const refChain = [...stackVids.slice(stackVids.indexOf(vid)), vid].join(' -> ')
        ctx.errors.push(semanticError(ctx, module, `circular module reference: ${refChain}`))
        return
    }
    ctx.moduleStack.push(module)
    // TODO: check duplicate useExprs
    // TODO: check self references
    module.references = module.useExprs.flatMap(useExpr => useExprToVids(useExpr, ctx))

    checkBlock(module.block, ctx, brief)

    ctx.moduleStack.pop()
    if (!brief) {
        module.checked = true
    }
}

const checkBlock = (block: Block, ctx: Context, brief: boolean = false): void => {
    const module = ctx.moduleStack.at(-1)!
    module.scopeStack.push({ type: 'block', definitions: new Map() })

    block.statements.forEach(s => checkStatement(s, ctx, true))
    if (!brief) {
        block.statements.forEach(s => checkStatement(s, ctx))
    }
    // TODO: block type

    module.scopeStack.pop()
}

const checkStatement = (statement: Statement, ctx: Context, brief: boolean = false): void => {
    const topLevel = ctx.moduleStack.at(-1)!.scopeStack.length === 1
    if (topLevel && !['var-def', 'fn-def', 'kind-def', 'impl-def', 'type-def'].includes(statement.kind)) {
        ctx.errors.push(semanticError(ctx, statement, `top level \`${statement.kind}\` is not allowed`))
        return
    }
    const scope = ctx.moduleStack.at(-1)!.scopeStack.at(-1)!
    if (['impl-def', 'kind-def'].includes(scope.type) && statement.kind !== 'fn-def') {
        ctx.errors.push(semanticError(ctx, statement, `\`${statement.kind}\` in instance scope is not allowed`))
        return
    }

    const pushDefToStack = () => {
        if (topLevel || brief) {
            addDefToScope(ctx, statement)
        }
    }

    switch (statement.kind) {
        case 'var-def':
            checkVarDef(statement, ctx, brief)
            pushDefToStack()
            break
        case 'fn-def':
            checkFnDef(statement, ctx, brief)
            pushDefToStack()
            break
        case 'kind-def':
            // todo
            checkKindDef(statement, ctx, brief)
            pushDefToStack()
            break
        case 'impl-def':
            // todo
            checkImplDef(statement, ctx, brief)
            pushDefToStack()
            break
        case 'type-def':
            // todo
            pushDefToStack()
            break
        case 'operand-expr':
        case 'unary-expr':
        case 'binary-expr':
            checkExpr(statement, ctx)
            break
        case 'return-stmt':
            break
    }
}

const checkExpr = (expr: Expr, ctx: Context): void => {
    switch (expr.kind) {
        case 'operand-expr':
            checkOperand(expr.operand, ctx)
            expr.type = expr.operand.type
            break
        case 'unary-expr':
            checkUnaryExpr(expr, ctx)
            // TODO: type
            expr.type = unknownType
            break
        case 'binary-expr':
            checkBinaryExpr(expr, ctx)
            expr.type = unknownType
            break
    }
}

const checkFnDef = (fnDef: FnDef, ctx: Context, brief: boolean = false): void => {
    const module = ctx.moduleStack.at(-1)!
    module.scopeStack.push({ type: 'fn-def', definitions: new Map(fnDef.generics.map(g => [g.name.value, g])) })

    const paramTypes = fnDef.params.map((p, i) => {
        checkParam(p, i, ctx)
        return p.type!
    })

    fnDef.params.forEach(p => {
        switch (p.pattern.kind) {
            case 'hole':
                break
            case 'name':
                module.scopeStack.at(-1)!.definitions.set(p.pattern.value, p)
                break
            case 'con-pattern':
                todo('add con-pattern to scope')
                break
        }
    })

    if (fnDef.returnType) {
        checkType(fnDef.returnType, ctx)
    }

    fnDef.type = {
        kind: 'fn-type',
        generics: fnDef.generics.map(genericToVirtual),
        paramTypes,
        returnType: fnDef.returnType ? typeToVirtual(fnDef.returnType) : unitType
    }

    if (!brief) {
        if (!fnDef.block) {
            if (instanceScope(ctx) === 'kind-def') {
                ctx.warnings.push(semanticError(ctx, fnDef, `fn \`${fnDef.name.value}\` has no body -> must be native`))
            }
        } else {
            checkBlock(fnDef.block, ctx)
        }
    }

    module.scopeStack.pop()
}

const checkParam = (param: Param, index: number, ctx: Context): void => {
    if (!param.paramType) {
        if (index === 0 && instanceScope(ctx) && param.pattern.kind === 'name' && param.pattern.value === 'self') {
            param.type = selfType
        } else {
            ctx.errors.push(semanticError(ctx, param, 'parameter type not specified'))
            param.type = unknownType
        }
    } else {
        checkType(param.paramType, ctx)
        param.type = typeToVirtual(param.paramType)
    }
    switch (param.pattern.kind) {
        case 'operand-expr':
        case 'unary-expr':
        case 'binary-expr':
            ctx.errors.push(semanticError(ctx, param.pattern, `\`${param.pattern.kind}\` can only be used in match expressions`))
    }
}

const checkKindDef = (kindDef: KindDef, ctx: Context, brief: boolean = false) => {
    const module = ctx.moduleStack.at(-1)!

    if (instanceScope(ctx)) {
        ctx.errors.push(semanticError(ctx, kindDef, `\`${kindDef.kind}\` within instance scope`))
        return
    }

    // TODO: add generics
    module.scopeStack.push({ type: 'kind-def', definitions: new Map() })

    checkBlock(kindDef.block, ctx, brief)

    module.scopeStack.pop()
}

const checkImplDef = (implDef: ImplDef, ctx: Context, brief: boolean = false) => {
    const module = ctx.moduleStack.at(-1)!

    if (instanceScope(ctx)) {
        ctx.errors.push(semanticError(ctx, implDef, `\`${implDef.kind}\` within instance scope`))
        return
    }

    // TODO: add generics
    module.scopeStack.push({ type: 'impl-def', definitions: new Map() })

    if (!brief) {
        checkBlock(implDef.block, ctx)
    }

    module.scopeStack.pop()
}

const checkVarDef = (varDef: VarDef, ctx: Context, brief: boolean = false): void => {
    checkExpr(varDef.expr, ctx)
    if (varDef.varType) {
        checkType(varDef.varType, ctx)
        varDef.type = typeToVirtual(varDef.varType)
        if (!isAssignable(varDef.expr.type!, varDef.type, ctx)) {
            ctx.errors.push(typeError(ctx, varDef, varDef.type, varDef.expr.type!))
        }
    } else {
        varDef.type = varDef.expr.type
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
        ctx.errors.push(semanticError(ctx, operand, message))
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
        ctx.errors.push(typeError(ctx, unaryExpr, operand.type!, t))
        return
    }
}

const checkBinaryExpr = (binaryExpr: BinaryExpr, ctx: Context): void => {
    if (binaryExpr.binaryOp.kind === 'access-op') {
        // TODO
        return
    }
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
        ctx.errors.push(semanticError(ctx, binaryExpr.binaryOp, message))
        return
    }

    const implFn = findImplFn(impl, opImplFnId, ctx)
    if (!implFn) throw Error('impl fn not found')
    if (!implFn.type) throw Error('untyped impl fn')
    if (implFn.type.kind !== 'fn-type') throw Error('impl fn type in not fn')

    const t: VirtualFnType = {
        kind: 'fn-type',
        generics: [],
        paramTypes: [binaryExpr.lOperand, binaryExpr.rOperand].map(o => o.type!),
        returnType: implFn.type.returnType
    }
    if (!isAssignable(t, implFn.type, ctx)) {
        ctx.errors.push(typeError(ctx, binaryExpr, implFn.type, t))
        return
    }
}

const checkOperand = (operand: Operand, ctx: Context): void => {
    switch (operand.kind) {
        case 'operand-expr':
            checkOperand(operand.operand, ctx)
            operand.type = operand.operand.type
            break
        case 'if-expr':
            // TODO
            break
        case 'while-expr':
            // TODO
            break
        case 'for-expr':
            // TODO
            break
        case 'match-expr':
            // TODO
            break
        case 'closure-expr':
            // TODO
            break
        case 'unary-expr':
            checkUnaryExpr(operand, ctx)
            break
        case 'binary-expr':
            checkBinaryExpr(operand, ctx)
            break
        case 'list-expr':
            // TODO
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
    if (!operand.type) {
        operand.type = unknownType
    }
}

const checkIdentifier = (identifier: Identifier, ctx: Context): void => {
    const vid = idToVid(identifier)
    const ref = resolveVid(vid, ctx)
    if (!ref) {
        ctx.errors.push(semanticError(ctx, identifier, `identifier ${vidToString(vid)} not found`))
        identifier.type = unknownType
    } else {
        identifier.type = 'type' in ref.def ? ref.def.type : unknownType
    }
}

const addDefToScope = (ctx: Context, statement: Statement): void => {
    const vid = statementVid(statement)
    if (!vid) return

    const def = statementToDefinition(statement)
    if (!def) return

    ctx.moduleStack.at(-1)!.scopeStack.at(-1)!.definitions.set(vidToString(vid), def)
}

const checkType = (type: Type, ctx: Context) => {
    switch (type.kind) {
        case 'variant-type':
            const vid = idToVid(type.identifier)
            const ref = resolveVid(vid, ctx)
            if (!ref) {
                ctx.errors.push(notFoundError(ctx, type.identifier, vid))
                return
            }
            type.typeParams.forEach(tp => checkType(tp, ctx))
            if (!['type-def', 'kind-def', 'generic', 'self'].includes(ref.def.kind)) {
                ctx.errors.push(semanticError(ctx, type.identifier, `expected type, got \`${ref.def.kind}\``))
                return
            }
            // TODO: type params typecheck
            return
        case 'fn-type':
            break
    }
}
