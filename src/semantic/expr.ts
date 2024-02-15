import { checkBlock, checkCallArgs, checkIdentifier, checkParam, checkType } from '.'
import { AstNode } from '../ast'
import { BinaryExpr, Expr, UnaryExpr } from '../ast/expr'
import { MatchExpr } from '../ast/match'
import { CallOp } from '../ast/op'
import {
    ClosureExpr,
    ForExpr,
    IfExpr,
    IfLetExpr,
    ListExpr,
    Operand,
    WhileExpr,
    identifierFromOperand
} from '../ast/operand'
import { Context, Scope, addError, fnDefScope, instanceScope } from '../scope'
import { bool, iter, iterable, unwrap } from '../scope/std'
import { getConcreteTrait } from '../scope/trait'
import { idToVid, vidEq, vidFromString, vidToString } from '../scope/util'
import { MethodDef, VariantDef, VirtualIdentifierMatch, resolveVid } from '../scope/vid'
import {
    VidType,
    VirtualFnType,
    VirtualType,
    combine,
    extractConcreteSupertype,
    isAssignable,
    typeToVirtual,
    virtualTypeToString
} from '../typecheck'
import {
    instanceGenericMap,
    makeFnGenericMap,
    makeFnTypeArgGenericMap,
    makeGenericMapOverStructure,
    replaceGenericsWithHoles,
    resolveType
} from '../typecheck/generic'
import { holeType, unitType, unknownType } from '../typecheck/type'
import { assert } from '../util/todo'
import { semanticError, typeError, unknownTypeError } from './error'
import { checkExhaustion } from './exhaust'
import { checkAccessExpr } from './instance'
import { checkPattern } from './match'
import { operatorImplMap } from './op'

export const checkExpr = (expr: Expr, ctx: Context): void => {
    switch (expr.kind) {
        case 'operand-expr':
            checkOperand(expr.operand, ctx)
            expr.type = expr.operand.type
            break
        case 'unary-expr':
            checkUnaryExpr(expr, ctx)
            break
        case 'binary-expr':
            checkBinaryExpr(expr, ctx)
            break
    }
}

export const checkOperand = (operand: Operand, ctx: Context): void => {
    switch (operand.kind) {
        case 'operand-expr':
            checkOperand(operand.operand, ctx)
            operand.type = operand.operand.type
            break
        case 'if-expr':
            checkIfExpr(operand, ctx)
            break
        case 'if-let-expr':
            checkIfLetExpr(operand, ctx)
            break
        case 'while-expr':
            checkWhileExpr(operand, ctx)
            break
        case 'for-expr':
            checkForExpr(operand, ctx)
            break
        case 'match-expr':
            checkMatchExpr(operand, ctx)
            break
        case 'closure-expr':
            checkClosureExpr(operand, ctx)
            break
        case 'unary-expr':
            checkUnaryExpr(operand, ctx)
            break
        case 'binary-expr':
            checkBinaryExpr(operand, ctx)
            break
        case 'list-expr':
            checkListExpr(operand, ctx)
            break
        case 'string-literal':
            operand.type = {
                kind: 'vid-type',
                identifier: vidFromString('std::string::String'),
                typeArgs: []
            }
            break
        case 'char-literal':
            operand.type = {
                kind: 'vid-type',
                identifier: vidFromString('std::char::Char'),
                typeArgs: []
            }
            break
        case 'int-literal':
            operand.type = {
                kind: 'vid-type',
                identifier: vidFromString('std::int::Int'),
                typeArgs: []
            }
            break
        case 'float-literal':
            operand.type = {
                kind: 'vid-type',
                identifier: vidFromString('std::float::Float'),
                typeArgs: []
            }
            break
        case 'bool-literal':
            operand.type = {
                kind: 'vid-type',
                identifier: vidFromString('std::bool::Bool'),
                typeArgs: []
            }
            break
        case 'identifier':
            checkIdentifier(operand, ctx)
            if (operand.type!.kind === 'unknown-type') {
                unknownTypeError(operand, operand.type!, ctx)
            }
            break
    }
    if (!operand.type) {
        operand.type = unknownType
    }
}

export const checkUnaryExpr = (unaryExpr: UnaryExpr, ctx: Context): void => {
    switch (unaryExpr.op.kind) {
        case 'call-op':
            checkCall(unaryExpr, ctx)
            return
        case 'unwrap-op':
            checkUnwrap(unaryExpr, ctx)
            return
        case 'bind-op':
            checkBind(unaryExpr, ctx)
            return
    }
}

export const checkBinaryExpr = (binaryExpr: BinaryExpr, ctx: Context): void => {
    if (binaryExpr.binaryOp.kind === 'access-op') {
        checkAccessExpr(binaryExpr, ctx)
        return
    }
    if (binaryExpr.binaryOp.kind === 'assign-op') {
        checkAssignExpr(binaryExpr, ctx)
        return
    }
    checkOperand(binaryExpr.lOperand, ctx)
    checkOperand(binaryExpr.rOperand, ctx)

    const opImplFnVid = operatorImplMap.get(binaryExpr.binaryOp.kind)
    assert(!!opImplFnVid, `operator ${binaryExpr.binaryOp.kind} without impl function`)

    const methodRef = <MethodDef>resolveVid(opImplFnVid!, ctx, ['method-def'])?.def
    assert(!!methodRef, `impl fn \`${vidToString(opImplFnVid!)}\` not found`)
    assert(!!methodRef.fn.type, 'untyped impl fn')
    assert(methodRef.fn.type!.kind === 'fn-type', 'impl fn type in not fn')

    const implTargetType = methodRef.rel.forType
    const fnType = <VirtualFnType>methodRef.fn.type
    if (isAssignable(binaryExpr.lOperand.type!, implTargetType, ctx)) {
        const genericMaps = makeBinaryExprGenericMaps(binaryExpr, fnType, implTargetType)
        const args = [binaryExpr.lOperand, binaryExpr.rOperand]
        const paramTypes = fnType.paramTypes.map(pt => resolveType(pt, genericMaps, ctx))
        checkCallArgs(binaryExpr, args, paramTypes, ctx)
        binaryExpr.type = resolveType(fnType.returnType, genericMaps, ctx)
    } else {
        addError(ctx, typeError(binaryExpr, binaryExpr.lOperand.type!, implTargetType, ctx))
        binaryExpr.type = unknownType
    }
}

export const checkIfExpr = (ifExpr: IfExpr, ctx: Context): void => {
    const module = ctx.moduleStack.at(-1)!
    const scope = module.scopeStack.at(-1)!

    checkExpr(ifExpr.condition, ctx)
    const condType = ifExpr.condition.type ?? unknownType
    if (!isAssignable(condType, bool, ctx)) {
        addError(ctx, typeError(ifExpr.condition, condType, bool, ctx))
    }

    checkIfExprCommon(ifExpr, scope, ctx)
}

export const checkIfLetExpr = (ifLetExpr: IfLetExpr, ctx: Context): void => {
    const module = ctx.moduleStack.at(-1)!
    const scope = module.scopeStack.at(-1)!
    module.scopeStack.push({ kind: 'block', definitions: new Map(), isLoop: false, allBranchesReturned: false })

    checkExpr(ifLetExpr.expr, ctx)
    assert(!!ifLetExpr.expr.type)
    // pattern definitions should only be available in `then` block
    checkPattern(ifLetExpr.pattern, ifLetExpr.expr.type!, ctx)

    checkIfExprCommon(ifLetExpr, scope, ctx)

    module.scopeStack.pop()
}

export const checkIfExprCommon = (ifExpr: IfExpr | IfLetExpr, scope: Scope, ctx: Context): void => {
    const thenAbr = checkBlock(ifExpr.thenBlock, ctx)
    if (ifExpr.elseBlock) {
        const elseAbr = checkBlock(ifExpr.elseBlock, ctx)

        if (scope.kind === 'block' && thenAbr && elseAbr) {
            scope.allBranchesReturned = true
        }

        const thenType = ifExpr.thenBlock.type!
        const elseType = ifExpr.elseBlock.type!
        const combined = combine(thenType, elseType, ctx)
        if (combined) {
            ifExpr.type = combined
        } else {
            ifExpr.type = { kind: 'unknown-type', mismatchedBranches: { then: thenType, else: elseType } }
        }
    } else {
        ifExpr.type = { kind: 'unknown-type', mismatchedBranches: { then: ifExpr.thenBlock.type! } }
    }
}

export const checkWhileExpr = (whileExpr: WhileExpr, ctx: Context): void => {
    const module = ctx.moduleStack.at(-1)!
    const scope = module.scopeStack.at(-1)!
    module.scopeStack.push({ kind: 'block', definitions: new Map(), isLoop: true, allBranchesReturned: false })

    checkExpr(whileExpr.condition, ctx)
    const condType = whileExpr.condition.type
    assert(!!condType)
    if (!isAssignable(condType!, bool, ctx)) {
        addError(ctx, typeError(whileExpr.condition, condType!, bool, ctx))
    }

    const abr = checkBlock(whileExpr.block, ctx)

    if (scope.kind === 'block' && abr) {
        scope.allBranchesReturned = true
    }

    whileExpr.type = {
        kind: 'vid-type',
        identifier: iter.identifier,
        typeArgs: [whileExpr.block.type!]
    }

    module.scopeStack.pop()
}

export const checkForExpr = (forExpr: ForExpr, ctx: Context): void => {
    const module = ctx.moduleStack.at(-1)!
    const scope = module.scopeStack.at(-1)!
    module.scopeStack.push({ kind: 'block', definitions: new Map(), isLoop: true, allBranchesReturned: false })

    checkExpr(forExpr.expr, ctx)
    assert(!!forExpr.expr.type)
    if (![iter, iterable].some(t => isAssignable(forExpr.expr.type!, t, ctx))) {
        addError(
            ctx,
            semanticError(ctx, forExpr.expr, `type ${virtualTypeToString(forExpr.expr.type!)} is not iterable`)
        )
    }

    const iterableType = [iter, iterable]
        .map(t => extractConcreteSupertype(forExpr.expr.type!, t.identifier, ctx))
        .filter(t => !!t)
        .at(0)
    assert(!!iterableType, 'unresolved iterable type')
    assert(iterableType!.kind === 'vid-type', `iterable type is ${iterableType!.kind}`)
    const itemType = (<VidType>iterableType).typeArgs.at(0)
    assert(!!itemType, 'unresolved item type')
    checkPattern(forExpr.pattern, itemType!, ctx)

    const abr = checkBlock(forExpr.block, ctx)
    assert(!!forExpr.block.type)

    if (scope.kind === 'block' && abr) {
        scope.allBranchesReturned = true
    }

    forExpr.type = {
        kind: 'vid-type',
        identifier: iter.identifier,
        typeArgs: [forExpr.block.type!]
    }

    module.scopeStack.pop()
}

export const checkMatchExpr = (matchExpr: MatchExpr, ctx: Context): void => {
    const module = ctx.moduleStack.at(-1)!
    const scope = module.scopeStack.at(-1)!
    const errors = ctx.errors.length

    checkExpr(matchExpr.expr, ctx)
    let abr = true
    matchExpr.clauses.forEach(clause => {
        clause.patterns.forEach(p => checkPattern(p, matchExpr.expr.type!, ctx))
        if (clause.guard) {
            checkExpr(clause.guard, ctx)
            const guardType = clause.guard.type!
            if (guardType.kind !== 'vid-type' || !isAssignable(guardType, bool, ctx)) {
                addError(ctx, typeError(clause.guard, guardType, bool, ctx))
            }
        }
        const clauseAbr = checkBlock(clause.block, ctx)
        if (!clauseAbr) {
            abr = false
        }
    })

    if (matchExpr.clauses.length !== 0) {
        const firstClauseBlock = matchExpr.clauses[0].block
        if (firstClauseBlock.type!.kind !== 'unknown-type') {
            const mismatchedType = matchExpr.clauses
                .slice(1)
                .some(clause => !isAssignable(clause.block.type!, firstClauseBlock.type!, ctx))
            if (mismatchedType) {
                matchExpr.type = {
                    kind: 'unknown-type',
                    mismatchedMatchClauses: matchExpr.clauses.map(c => c.block.type!)
                }
            } else {
                matchExpr.type = firstClauseBlock.type
            }
        } else {
            addError(ctx, unknownTypeError(firstClauseBlock, firstClauseBlock.type!, ctx))
        }
    }

    if (scope.kind === 'block' && abr) {
        scope.allBranchesReturned = true
    }

    // exhaustion assumes that every pattern is semantically correct, so run it only when no errors were found in the
    // matchExpr
    if (errors === ctx.errors.length) {
        checkExhaustion(matchExpr, ctx)
    }
}

/**
 * TODO: better error reporting when inferredType is provided
 * TODO: closure generics
 */
export const checkClosureExpr = (
    closureExpr: ClosureExpr,
    ctx: Context,
    caller?: AstNode<any>,
    inferredType?: VirtualFnType
): void => {
    if (closureExpr.type && closureExpr.type.kind !== 'malleable-type') return

    if (!inferredType && (!closureExpr.returnType || closureExpr.params.some(p => !!p.paramType))) {
        // untyped closures concrete type is defined by its first usage
        // malleable type is an indicator that concrete type is yet to be defined
        closureExpr.type = { kind: 'malleable-type', closure: closureExpr }
        // since param/return types are unknown, no reason to perform semantic checking yet
        // TODO: semantic checking if closure is never called (if type is still malleable by the end of scope)
        return
    }

    const module = ctx.moduleStack.at(-1)!
    module.scopeStack.push({ kind: 'fn', definitions: new Map(), def: closureExpr, returnStatements: [] })

    if (caller && inferredType) {
        if (closureExpr.params.length > inferredType.paramTypes.length) {
            const msg = `expected ${closureExpr.params.length} arguments, got ${inferredType.paramTypes.length}`
            addError(ctx, semanticError(ctx, caller, msg))
            return
        }
        for (let i = 0; i < closureExpr.params.length; i++) {
            const param = closureExpr.params[i]
            param.type = inferredType.paramTypes[i]
            checkPattern(param.pattern, param.type, ctx)
        }

        closureExpr.type = {
            kind: 'fn-type',
            paramTypes: closureExpr.params.map(p => p.type!),
            returnType: inferredType.returnType,
            generics: []
        }
    } else {
        closureExpr.params.forEach((p, i) => checkParam(p, i, ctx))
        checkType(closureExpr.returnType!, ctx)
        closureExpr.type = {
            kind: 'fn-type',
            paramTypes: closureExpr.params.map(p => typeToVirtual(p.paramType!, ctx)),
            returnType: typeToVirtual(closureExpr.returnType!, ctx),
            generics: []
        }
    }

    checkBlock(closureExpr.block, ctx)
    if (closureExpr.type.returnType.kind === 'unknown-type') {
        closureExpr.type.returnType = closureExpr.block.type!
    }

    module.scopeStack.pop()
}

export const checkCall = (unaryExpr: UnaryExpr, ctx: Context): void => {
    const call = <CallOp>unaryExpr.op
    const operand = unaryExpr.operand
    checkOperand(operand, ctx)
    const args = call.args.map(a => a.expr)
    args.forEach(a => checkExpr(a, ctx))
    const variantRef = variantCallRef(operand, ctx)
    if (variantRef) {
        // variant call
        unaryExpr.type = checkVariantCall(unaryExpr, variantRef, ctx)
    } else {
        // function call
        unaryExpr.type = checkCall_(call, operand, args, ctx)
    }
}

export const checkVariantCall = (
    unaryExpr: UnaryExpr,
    ref: VirtualIdentifierMatch<VariantDef>,
    ctx: Context
): VirtualType | undefined => {
    const call = <CallOp>unaryExpr.op
    call.args.forEach(a => checkExpr(a.expr, ctx))

    for (const arg of call.args) {
        if (!arg.name) {
            const id = identifierFromOperand(arg.expr)
            if (id) {
                arg.name = id.names.at(-1)!
            }
        }
    }

    const allArgsNamed = call.args.every(arg => arg.name)
    const orderedArgs = []
    if (allArgsNamed) {
        let argsHaveErrors = false
        const missingFields = []
        for (const fieldDef of ref.def.variant.fieldDefs) {
            const field = call.args.find(a => a.name!.value === fieldDef.name.value)
            if (!field) {
                missingFields.push(fieldDef)
                continue
            }
            orderedArgs.push(field)
        }
        if (missingFields.length > 0) {
            const msg = `missing fields: ${missingFields.map(f => `\`${f.name.value}\``).join(', ')}`
            addError(ctx, semanticError(ctx, call, msg))
            argsHaveErrors = true
        }
        for (const arg of call.args) {
            if (!orderedArgs.includes(arg)) {
                const msg = `unknown field: \`${arg.name!.value}\``
                addError(ctx, semanticError(ctx, arg.name!, msg))
                argsHaveErrors = true
            }
        }

        if (argsHaveErrors) {
            // TODO: set variant type
            return unknownType
        }
    }

    // if there are regular positional args, call it as a regular function
    const args = (allArgsNamed ? orderedArgs : call.args).map(a => a?.expr)
    return checkCall_(call, unaryExpr.operand, args, ctx)
}

export const checkCall_ = (call: AstNode<any>, operand: Operand, args: Expr[], ctx: Context): VirtualType => {
    if (operand.type?.kind === 'malleable-type') {
        const closureType: VirtualFnType = {
            kind: 'fn-type',
            generics: [],
            paramTypes: args.map(arg => arg.type ?? unknownType),
            returnType: unknownType
        }
        const closure = operand.type.closure
        checkClosureExpr(closure, ctx, operand, closureType)
        operand.type = closure.type
    }

    if (operand.type?.kind === 'unknown-type') {
        addError(ctx, unknownTypeError(operand, operand.type, ctx))
        return unknownType
    }
    if (operand.type?.kind !== 'fn-type') {
        const message = `type error: non-callable operand of type \`${virtualTypeToString(operand.type!)}\``
        addError(ctx, semanticError(ctx, operand, message))
        return unknownType
    }

    const fnType = <VirtualFnType>operand.type
    const genericMaps = makeFnGenericMaps(
        operand.kind === 'identifier' ? operand.typeArgs.map(tp => typeToVirtual(tp, ctx)) : [],
        fnType,
        args.map(a => a.type!),
        ctx
    )
    const paramTypes = fnType.paramTypes.map(pt => resolveType(pt, genericMaps, ctx))
    // TODO: if it is a vid type call without args (e.g. Option::Some()), use checkNamedCall() reporting
    checkCallArgs(call, args, paramTypes, ctx)

    return replaceGenericsWithHoles(resolveType(fnType.returnType, genericMaps, ctx))
}

export const checkUnwrap = (unaryExpr: UnaryExpr, ctx: Context): void => {
    const operand = unaryExpr.operand
    checkOperand(operand, ctx)
    const unwrapType = findUnwrapInnerType(operand.type!, ctx)
    if (!unwrapType) {
        addError(ctx, typeError(unaryExpr, operand.type!, unwrap, ctx))
        unaryExpr.type = unknownType
        return
    }
    const innerType = (<VidType>unwrapType).typeArgs[0]
    unaryExpr.type = innerType
}

export const checkBind = (unaryExpr: UnaryExpr, ctx: Context): void => {
    const operand = unaryExpr.operand
    checkOperand(operand, ctx)
    const unwrapType = findUnwrapInnerType(operand.type!, ctx)
    if (!unwrapType) {
        addError(ctx, typeError(unaryExpr, operand.type!, unwrap, ctx))
        unaryExpr.type = unknownType
        return
    }
    const innerType = (<VidType>unwrapType).typeArgs[0]
    unaryExpr.type = innerType

    const scope = fnDefScope(ctx)
    if (!scope) {
        addError(ctx, semanticError(ctx, unaryExpr.op, `\`${unaryExpr.op.kind}\` outside of the function scope`))
        return
    }
    scope.returnStatements.push(operand)
}

export const findUnwrapInnerType = (type: VirtualType, ctx: Context): VirtualType | undefined => {
    const unwrapRel = ctx.impls.find(
        i =>
            vidEq(i.implDef.vid, unwrap.identifier) &&
            // TODO: properly handle generics
            isAssignable(type, replaceGenericsWithHoles(i.forType), ctx)
    )
    if (!unwrapRel) {
        return undefined
    }
    return getConcreteTrait(type, unwrapRel, ctx)
}

export const variantCallRef = (operand: Operand, ctx: Context): VirtualIdentifierMatch<VariantDef> | undefined => {
    if (operand.kind !== 'identifier') {
        return undefined
    }

    const old = ctx.silent
    ctx.silent = true
    checkOperand(operand, ctx)
    ctx.silent = old

    const vid = idToVid(operand)
    const ref = resolveVid(vid, ctx)
    if (!ref || ref.def.kind !== 'variant') {
        return undefined
    }
    return <VirtualIdentifierMatch<VariantDef>>ref
}

export const checkListExpr = (listExpr: ListExpr, ctx: Context): void => {
    listExpr.exprs.forEach(e => checkExpr(e, ctx))
    const itemType = listExpr.exprs.length === 0 ? holeType : listExpr.exprs.at(0)?.type ?? unknownType
    for (let i = 1; i < listExpr.exprs.length; i++) {
        const expr = listExpr.exprs[i]
        const otherType = expr.type!
        if (!combine(itemType, otherType, ctx)) {
            addError(ctx, typeError(expr, otherType, itemType, ctx))
        }
    }
    listExpr.type = { kind: 'vid-type', identifier: vidFromString('std::list::List'), typeArgs: [itemType] }
}

export const checkAssignExpr = (binaryExpr: BinaryExpr, ctx: Context): void => {
    binaryExpr.type = unitType
    checkOperand(binaryExpr.lOperand, ctx)
    checkOperand(binaryExpr.rOperand, ctx)
    const assigneeType = binaryExpr.lOperand.type!
    const valueType = binaryExpr.rOperand.type!
    if (!isAssignable(valueType, assigneeType, ctx)) {
        addError(ctx, typeError(binaryExpr, valueType, assigneeType, ctx))
    }
}

export const makeFnGenericMaps = (
    typeArgs: VirtualType[],
    fnType: VirtualFnType,
    args: VirtualType[],
    ctx: Context
): Map<string, VirtualType>[] => {
    const fnTypeArgMap = makeFnTypeArgGenericMap(fnType, typeArgs)
    const instScope = instanceScope(ctx)
    const instanceMap = instScope ? instanceGenericMap(instScope, ctx) : new Map()
    const fnMap = makeFnGenericMap(fnType, args)
    return [instanceMap, fnTypeArgMap, fnMap]
}

export const makeUnaryExprGenericMaps = (
    operandType: VirtualType,
    fnType: VirtualFnType,
    implTargetType: VirtualType
): Map<string, VirtualType>[] => {
    const implGenericMap = makeGenericMapOverStructure(operandType, implTargetType)
    const fnGenericMap = makeFnGenericMap(fnType, [operandType])
    return [implGenericMap, fnGenericMap]
}

export const makeBinaryExprGenericMaps = (
    binaryExpr: BinaryExpr,
    fnType: VirtualFnType,
    implTargetType: VirtualType
): Map<string, VirtualType>[] => {
    const implGenericMap = makeGenericMapOverStructure(binaryExpr.lOperand.type!, implTargetType)
    const fnGenericMap = makeFnGenericMap(fnType, [binaryExpr.lOperand.type!, binaryExpr.rOperand.type!])
    return [implGenericMap, fnGenericMap]
}
