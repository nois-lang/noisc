import { checkBlock, checkCallArgs, checkIdentifier, checkParam, checkType } from '.'
import { Arg, AstNode } from '../ast'
import { BinaryExpr, Expr, UnaryExpr } from '../ast/expr'
import { MatchExpr } from '../ast/match'
import { CallOp } from '../ast/op'
import { ClosureExpr, ForExpr, Identifier, IfExpr, IfLetExpr, ListExpr, Name, Operand, WhileExpr } from '../ast/operand'
import { FieldDef } from '../ast/type-def'
import { Context, Scope, addError, enterScope, fnDefScope, instanceScope, leaveScope } from '../scope'
import { bool, future, iter, iterable, show, string, unwrap } from '../scope/std'
import {
    InstanceRelation,
    getConcreteTrait,
    getInstanceForType,
    resolveMethodImpl,
    resolveTypeImpl,
    typeDefToVirtualType
} from '../scope/trait'
import { idToVid, vidEq, vidFromString, vidToString } from '../scope/util'
import { MethodDef, VariantDef, VirtualIdentifier, VirtualIdentifierMatch, resolveVid, typeKinds } from '../scope/vid'
import {
    VidType,
    VirtualFnType,
    VirtualType,
    combine,
    extractConcreteSupertype,
    isAssignable,
    typeToVirtual
} from '../typecheck'
import {
    instanceGenericMap,
    makeFnGenericMap,
    makeFnTypeArgGenericMap,
    makeGenericMapOverStructure,
    replaceGenericsWithHoles,
    resolveType
} from '../typecheck/generic'
import { holeType, selfType, unknownType } from '../typecheck/type'
import { assert, unreachable } from '../util/todo'
import {
    argCountMismatchError,
    missingFieldsError,
    noImplFoundError,
    nonCallableError,
    notFoundError,
    notInFnScopeError,
    notIterableError,
    typeError,
    unexpectedNamedArgError,
    unknownTypeError
} from './error'
import { checkExhaustion } from './exhaust'
import { checkFieldAccess, checkMethodCall } from './instance'
import { checkPattern } from './match'
import { operatorImplMap } from './op'
import { upcast } from './upcast'

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
        case 'binary-expr':
            checkExpr(operand, ctx)
            break
        case 'list-expr':
            checkListExpr(operand, ctx)
            break
        case 'string-literal': {
            const vid = vidFromString('std::string::String')
            const ref = resolveVid(vid, ctx, ['type-def'])
            if (!ref || ref.def.kind !== 'type-def') {
                addError(ctx, notFoundError(ctx, operand, vidToString(vid)))
                break
            }
            operand.type = typeDefToVirtualType(ref.def, ctx, ref.module)
            break
        }
        case 'string-interpolated': {
            for (const t of operand.tokens) {
                if (typeof t !== 'string') {
                    checkExpr(t, ctx)
                    upcast(t, t.type!, show, ctx)
                    const type = extractConcreteSupertype(t.type!, show.identifier, ctx)
                    if (!type) {
                        addError(ctx, typeError(ctx, t, t.type!, show))
                    }
                }
            }
            operand.type = string
            break
        }
        case 'char-literal': {
            const vid = vidFromString('std::char::Char')
            const ref = resolveVid(vid, ctx, ['type-def'])
            if (!ref || ref.def.kind !== 'type-def') {
                addError(ctx, notFoundError(ctx, operand, vidToString(vid)))
                break
            }
            operand.type = typeDefToVirtualType(ref.def, ctx, ref.module)
            break
        }
        case 'int-literal': {
            const vid = vidFromString('std::int::Int')
            const ref = resolveVid(vid, ctx, ['type-def'])
            if (!ref || ref.def.kind !== 'type-def') {
                addError(ctx, notFoundError(ctx, operand, vidToString(vid)))
                break
            }
            operand.type = typeDefToVirtualType(ref.def, ctx, ref.module)
            break
        }
        case 'float-literal': {
            const vid = vidFromString('std::float::Float')
            const ref = resolveVid(vid, ctx, ['type-def'])
            if (!ref || ref.def.kind !== 'type-def') {
                addError(ctx, notFoundError(ctx, operand, vidToString(vid)))
                break
            }
            operand.type = typeDefToVirtualType(ref.def, ctx, ref.module)
            break
        }
        case 'bool-literal': {
            const vid = vidFromString('std::bool::Bool')
            const ref = resolveVid(vid, ctx, ['type-def'])
            if (!ref || ref.def.kind !== 'type-def') {
                addError(ctx, notFoundError(ctx, operand, vidToString(vid)))
                break
            }
            operand.type = typeDefToVirtualType(ref.def, ctx, ref.module)
            break
        }
        case 'identifier':
            checkIdentifier(operand, ctx)
            break
    }
    if (!operand.type) {
        operand.type = unknownType
    }
}

export const checkUnaryExpr = (unaryExpr: UnaryExpr, ctx: Context): void => {
    switch (unaryExpr.op.kind) {
        case 'method-call-op':
            unaryExpr.type = checkMethodCall(unaryExpr, unaryExpr.op, ctx) ?? unknownType
            return
        case 'field-access-op':
            unaryExpr.type = checkFieldAccess(unaryExpr.operand, unaryExpr.op.name, ctx) ?? unknownType
            return
        case 'call-op':
            checkCall(unaryExpr, ctx)
            return
        case 'unwrap-op':
            checkUnwrap(unaryExpr, ctx)
            return
        case 'bind-op':
            checkBind(unaryExpr, ctx)
            return
        case 'await-op':
            checkAwait(unaryExpr, ctx)
            return
    }
}

export const checkBinaryExpr = (binaryExpr: BinaryExpr, ctx: Context): void => {
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
        const impl = resolveMethodImpl(binaryExpr.lOperand.type!, methodRef, ctx)
        if (impl) {
            binaryExpr.binaryOp.impl = impl
            ctx.moduleStack.at(-1)!.relImports.push(impl)
        }
    } else {
        addError(ctx, typeError(ctx, binaryExpr, binaryExpr.lOperand.type!, implTargetType))
        binaryExpr.type = unknownType
    }
}

export const checkIfExpr = (ifExpr: IfExpr, ctx: Context): void => {
    const module = ctx.moduleStack.at(-1)!
    const scope = module.scopeStack.at(-1)!

    checkExpr(ifExpr.condition, ctx)
    const condType = ifExpr.condition.type ?? unknownType
    if (!isAssignable(condType, bool, ctx)) {
        addError(ctx, typeError(ctx, ifExpr.condition, condType, bool))
    }

    checkIfExprCommon(ifExpr, scope, ctx)
}

export const checkIfLetExpr = (ifLetExpr: IfLetExpr, ctx: Context): void => {
    const module = ctx.moduleStack.at(-1)!
    const scopeOuter = module.scopeStack.at(-1)!
    const scope: Scope = {
        kind: 'block',
        definitions: new Map(),
        closures: [],
        isLoop: false,
        allBranchesReturned: false
    }
    enterScope(module, scope, ctx)

    checkExpr(ifLetExpr.expr, ctx)
    assert(!!ifLetExpr.expr.type)
    // pattern definitions should only be available in `then` block
    checkPattern(ifLetExpr.pattern, ifLetExpr.expr.type!, ctx)

    checkIfExprCommon(ifLetExpr, scopeOuter, ctx)

    leaveScope(module, ctx)
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
    const outerScope = module.scopeStack.at(-1)!
    const scope: Scope = {
        kind: 'block',
        definitions: new Map(),
        closures: [],
        isLoop: true,
        allBranchesReturned: false
    }
    enterScope(module, scope, ctx)

    checkExpr(whileExpr.condition, ctx)
    const condType = whileExpr.condition.type
    assert(!!condType)
    if (!isAssignable(condType!, bool, ctx)) {
        addError(ctx, typeError(ctx, whileExpr.condition, condType!, bool))
    }

    const abr = checkBlock(whileExpr.block, ctx)

    if (outerScope.kind === 'block' && abr) {
        outerScope.allBranchesReturned = true
    }

    whileExpr.type = unknownType

    leaveScope(module, ctx)
}

export const checkForExpr = (forExpr: ForExpr, ctx: Context): void => {
    const module = ctx.moduleStack.at(-1)!
    const outerScope = module.scopeStack.at(-1)!
    const scope: Scope = {
        kind: 'block',
        definitions: new Map(),
        closures: [],
        isLoop: true,
        allBranchesReturned: false
    }
    enterScope(module, scope, ctx)

    checkExpr(forExpr.expr, ctx)
    assert(!!forExpr.expr.type)
    if (![iter, iterable].some(t => isAssignable(forExpr.expr.type!, t, ctx))) {
        addError(ctx, notIterableError(ctx, forExpr.expr))
    }

    const iterableType = [iter, iterable]
        .map(t => extractConcreteSupertype(forExpr.expr.type!, t.identifier, ctx))
        .find(t => !!t)
    if (iterableType) {
        assert(iterableType!.kind === 'vid-type', `iterable type is ${iterableType!.kind}`)
        const itemType = (<VidType>iterableType).typeArgs.at(0)
        assert(!!itemType, 'unresolved item type')
        checkPattern(forExpr.pattern, itemType!, ctx)
    } else {
        addError(ctx, notIterableError(ctx, forExpr.expr))
    }

    const abr = checkBlock(forExpr.block, ctx)
    assert(!!forExpr.block.type)

    if (outerScope.kind === 'block' && abr) {
        outerScope.allBranchesReturned = true
    }

    forExpr.type = unknownType

    // TODO: only one needed
    upcast(forExpr.expr, forExpr.expr.type!, iter, ctx)
    upcast(forExpr.expr, forExpr.expr.type!, iterable, ctx)

    leaveScope(module, ctx)
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
                addError(ctx, typeError(ctx, clause.guard, guardType, bool))
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
            addError(ctx, unknownTypeError(ctx, firstClauseBlock, firstClauseBlock.type!))
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
export const checkClosureExpr = (closureExpr: ClosureExpr, ctx: Context): void => {
    if (closureExpr.type && closureExpr.type.kind !== 'malleable-type') return

    if (!closureExpr.returnType || closureExpr.params.some(p => !!p.paramType)) {
        // untyped closures concrete type is defined by its first usage
        // malleable type is an indicator that concrete type is yet to be defined
        closureExpr.type = { kind: 'malleable-type', operand: closureExpr }
        // since param/return types are unknown, no reason to perform semantic checking yet
        // if closure is never called statically, semantic checking is performed when it goes out of scope
        ctx.moduleStack.at(-1)!.scopeStack.at(-1)!.closures.push(closureExpr)
        return
    }

    const module = ctx.moduleStack.at(-1)!
    const scope: Scope = { kind: 'fn', definitions: new Map(), closures: [], def: closureExpr, returns: [] }
    enterScope(module, scope, ctx)

    closureExpr.params.forEach((p, i) => checkParam(p, i, ctx))
    checkType(closureExpr.returnType!, ctx)
    closureExpr.type = {
        kind: 'fn-type',
        paramTypes: closureExpr.params.map(p => typeToVirtual(p.paramType!, ctx)),
        returnType: typeToVirtual(closureExpr.returnType!, ctx),
        generics: []
    }

    checkBlock(closureExpr.block, ctx)
    closureExpr.type.returnType = closureExpr.block.type!

    leaveScope(module, ctx)
}

export const checkResolvedClosureExpr = (
    closureExpr: ClosureExpr,
    ctx: Context,
    caller: AstNode<any>,
    inferredType: VirtualFnType
): VirtualType => {
    if (closureExpr.params.length > inferredType.paramTypes.length) {
        addError(ctx, argCountMismatchError(ctx, caller, closureExpr.params.length, inferredType.paramTypes.length))
        return unknownType
    }

    const module = ctx.moduleStack.at(-1)!
    const scope: Scope = { kind: 'fn', definitions: new Map(), closures: [], def: closureExpr, returns: [] }
    enterScope(module, scope, ctx)

    for (let i = 0; i < closureExpr.params.length; i++) {
        const param = closureExpr.params[i]
        param.type = inferredType.paramTypes[i]
        checkPattern(param.pattern, param.type, ctx)
    }

    checkBlock(closureExpr.block, ctx)

    leaveScope(module, ctx)
    return {
        kind: 'fn-type',
        paramTypes: closureExpr.params.map(p => p.type!),
        returnType: closureExpr.block.type!,
        generics: []
    }
}

export const checkQualifiedMethodCall = (
    identifier: Identifier,
    ref: VirtualIdentifierMatch<MethodDef>,
    ctx: Context,
    call?: CallOp,
    inferred?: VirtualFnType
): VirtualType => {
    assert(!!call || !!inferred)
    const fnType = <VirtualFnType>ref.def.fn.type
    const self = !ref.def.fn.static ? call?.args[0].expr.type! ?? inferred : undefined

    let impl: InstanceRelation | undefined = undefined
    if (ref.def.rel.instanceDef.kind === 'trait-def' && self && self.kind === 'vid-type') {
        const operandTypeRef = resolveVid(self.identifier, ctx, typeKinds)
        const resolved = resolveMethodImpl(self, ref.def, ctx)
        if (resolved) {
            impl = resolved
            ctx.moduleStack.at(-1)!.relImports.push(impl)
        } else {
            if (operandTypeRef && operandTypeRef.def.kind !== 'trait-def' && operandTypeRef.def.kind !== 'generic') {
                addError(ctx, noImplFoundError(ctx, identifier, ref.def, self))
            }
        }
    } else {
        // TODO: probably incorrect
        if (ref.def.fn.static && ref.def.fn.block) {
            impl = ref.def.rel
            ctx.moduleStack.at(-1)!.relImports.push(impl)
        }
    }
    identifier.impl = impl

    // TODO
    const maps: Map<string, VirtualType>[] = []

    if (impl && self) {
        const operandRel = resolveTypeImpl(self, impl.forType, ctx)
        if (operandRel) {
            const operandImplGenericMap = makeGenericMapOverStructure(operandRel.impl.implType, impl.forType)
            maps.push(operandImplGenericMap)
        }
    }

    const implForType = getInstanceForType(ref.def.rel.instanceDef, ctx)
    if (self) {
        const implForGenericMap = makeGenericMapOverStructure(self, implForType)
        // if Self type param is explicit, `resolveGenericsOverStructure` treats it as regular generic and interrupts
        // further mapping in `fnGenericMap`, thus should be removed
        implForGenericMap.delete(selfType.name)
        maps.push(implForGenericMap)
    } else {
        maps.push(new Map([[selfType.name, implForType]]))
    }
    const fnGenericMap = makeFnGenericMap(fnType, call?.args.map(a => a.expr.type!) ?? inferred!.paramTypes)
    maps.push(fnGenericMap)

    if (call) {
        checkCallArgs(
            call,
            call.args.map(a => a.expr),
            fnType.paramTypes,
            ctx
        )
    }

    const argTypes = call?.args.map(a => a.expr.type!) ?? inferred!.paramTypes
    return {
        kind: 'fn-type',
        paramTypes: argTypes.map(t => resolveType(t, maps, ctx)),
        returnType: resolveType(fnType.returnType, maps, ctx),
        // TODO: generics
        generics: []
    }
}

export const checkCall = (unaryExpr: UnaryExpr, ctx: Context): void => {
    const call = <CallOp>unaryExpr.op
    const operand = unaryExpr.operand
    checkOperand(operand, ctx)
    const args = call.args.map(a => a.expr)
    args.forEach(a => checkExpr(a, ctx))
    const variantRef = variantCallRef(operand, ctx)
    if (variantRef) {
        unaryExpr.type = checkVariantCall(unaryExpr, variantRef, ctx)
    } else {
        call.args.filter(arg => arg.name !== undefined).forEach(arg => addError(ctx, unexpectedNamedArgError(ctx, arg)))
        unaryExpr.type = checkCall_(call, operand, args, ctx)
    }
}

export const checkVariantCall = (
    unaryExpr: UnaryExpr,
    ref: VirtualIdentifierMatch<VariantDef>,
    ctx: Context
): VirtualType | undefined => {
    const extractArgName = (arg: Arg): Name | undefined => {
        if (arg.name) return arg.name
        if (arg.expr.kind !== 'operand-expr') return undefined
        if (arg.expr.operand.kind !== 'identifier') return undefined
        const id = arg.expr.operand
        if (id.names.length !== 1) return undefined
        const name = id.names[0]
        return name
    }

    const call = <CallOp>unaryExpr.op
    call.args.forEach(a => checkExpr(a.expr, ctx))

    const namedArgsStrategy = call.args.every(arg => {
        const name = extractArgName(arg)
        if (!name) return false
        if (!ref.def.variant.fieldDefs.find(f => f.name.value === name.value)) return false
        return true
    })

    const errorCount = ctx.errors.length
    const orderedArgs: Arg[] = []
    if (namedArgsStrategy) {
        const argNames = new Map(call.args.map(arg => [arg, extractArgName(arg)!]))
        const missingFields: FieldDef[] = []
        for (const fieldDef of ref.def.variant.fieldDefs) {
            const field = call.args.find(a => argNames.get(a)!.value === fieldDef.name.value)
            if (!field) {
                missingFields.push(fieldDef)
                continue
            }
            orderedArgs.push(field)
        }
        if (missingFields.length > 0) {
            addError(ctx, missingFieldsError(ctx, call, missingFields))
        }
        for (const arg of call.args) {
            const name = argNames.get(arg)!
            if (!orderedArgs.includes(arg)) {
                addError(ctx, notFoundError(ctx, name, name.value, 'field'))
            }
        }
    } else {
        if (call.args.some(arg => arg.name)) {
            for (const arg of call.args) {
                if (arg.name && !ref.def.variant.fieldDefs.find(f => f.name.value === arg.name!.value)) {
                    addError(ctx, notFoundError(ctx, arg, arg.name.value, 'field'))
                }
            }
        }
    }

    if (ctx.errors.length > errorCount) {
        // TODO: set variant type
        return unknownType
    }

    call.variantDef = ref.def
    // if there are regular positional args, call it as a regular function
    const args = (namedArgsStrategy ? orderedArgs : call.args).map(a => a?.expr)
    return checkCall_(call, unaryExpr.operand, args, ctx)
}

export const checkCall_ = (call: CallOp, operand: Operand, args: Expr[], ctx: Context): VirtualType => {
    if (operand.type?.kind === 'malleable-type') {
        const inferredType: VirtualFnType = {
            kind: 'fn-type',
            generics: [],
            paramTypes: args.map(arg => arg.type ?? unknownType),
            returnType: unknownType
        }
        switch (operand.type.operand.kind) {
            case 'closure-expr':
                const closure = operand.type.operand
                operand.type = checkResolvedClosureExpr(closure, ctx, operand, inferredType)
                break
            case 'identifier':
                // TODO: properly
                const ref = operand.type!.operand.ref
                if (ref?.def.kind !== 'method-def') return unreachable()
                call.methodDef = ref.def
                operand.type = checkQualifiedMethodCall(
                    operand.type.operand,
                    <VirtualIdentifierMatch<MethodDef>>ref,
                    ctx,
                    call
                )
                break
            default:
                unreachable(operand.type.operand.kind)
        }
    }
    if (operand.type?.kind === 'unknown-type') {
        addError(ctx, unknownTypeError(ctx, operand, operand.type))
        return unknownType
    }
    if (operand.type?.kind !== 'fn-type') {
        addError(ctx, nonCallableError(ctx, operand))
        return unknownType
    }

    const fnType = <VirtualFnType>operand.type

    const genericMaps = makeFnGenericMaps(
        operand.kind === 'identifier' ? operand.typeArgs.map(tp => typeToVirtual(tp, ctx)) : [],
        fnType,
        args.map(a => a.type!),
        ctx
    )
    checkCallArgs(call, args, fnType.paramTypes, ctx)

    call.generics = fnType.generics.map((g, i) => {
        const typeArg = operand.kind === 'identifier' ? operand.typeArgs.at(i) : undefined
        if (!typeArg) return { generic: g, impls: [] }
        const vTypeArg = typeToVirtual(typeArg, ctx)
        const t = resolveType(g, [genericMaps[1]], ctx)
        if (t.kind !== 'generic') return { generic: g, impls: [] }
        const impls = g.bounds.flatMap(b => {
            const res = resolveTypeImpl(vTypeArg, b, ctx)
            if (res) {
                return [res.impl]
            }
            return []
        })
        ctx.moduleStack.at(-1)!.relImports.push(...impls)
        return { generic: g, impls }
    })

    return replaceGenericsWithHoles(resolveType(fnType.returnType, genericMaps, ctx))
}

export const checkUnwrap = (unaryExpr: UnaryExpr, ctx: Context): void => {
    const operand = unaryExpr.operand
    checkOperand(operand, ctx)
    const unwrapType = findTraitInnerType(operand.type!, unwrap.identifier, ctx)
    if (!unwrapType) {
        addError(ctx, typeError(ctx, unaryExpr, operand.type!, unwrap))
        unaryExpr.type = unknownType
        return
    }
    const innerType = (<VidType>unwrapType).typeArgs[0]
    unaryExpr.type = innerType

    upcast(operand, operand.type!, unwrap, ctx)
}

export const checkBind = (unaryExpr: UnaryExpr, ctx: Context): void => {
    const operand = unaryExpr.operand
    checkOperand(operand, ctx)
    const unwrapType = findTraitInnerType(operand.type!, unwrap.identifier, ctx)
    if (!unwrapType) {
        addError(ctx, typeError(ctx, unaryExpr, operand.type!, unwrap))
        unaryExpr.type = unknownType
        return
    }
    const innerType = (<VidType>unwrapType).typeArgs[0]
    unaryExpr.type = innerType

    const scope = fnDefScope(ctx)
    if (!scope) {
        addError(ctx, notInFnScopeError(ctx, unaryExpr.op))
        return
    }
    scope.returns.push(operand)

    upcast(operand, operand.type!, unwrap, ctx)
}

export const checkAwait = (unaryExpr: UnaryExpr, ctx: Context): void => {
    const operand = unaryExpr.operand
    checkOperand(operand, ctx)
    if (!(operand.type?.kind === 'vid-type' && vidEq(operand.type.identifier, future.identifier))) {
        addError(ctx, typeError(ctx, unaryExpr.op, operand.type!, future))
        unaryExpr.type = unknownType
        return
    }
    const innerType = operand.type.typeArgs[0]
    unaryExpr.type = innerType

    const scope = fnDefScope(ctx)
    if (!scope) {
        addError(ctx, notInFnScopeError(ctx, unaryExpr.op))
        return
    }

    upcast(operand, operand.type!, future, ctx)
}

export const findTraitInnerType = (
    type: VirtualType,
    trait: VirtualIdentifier,
    ctx: Context
): VirtualType | undefined => {
    const traitRel = ctx.impls.find(
        i =>
            vidEq(i.implDef.vid, trait) &&
            // TODO: properly handle generics
            isAssignable(type, replaceGenericsWithHoles(i.forType), ctx)
    )
    if (!traitRel) {
        return undefined
    }
    return getConcreteTrait(type, traitRel, ctx)
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
            addError(ctx, typeError(ctx, expr, otherType, itemType))
        }
    }
    const listVid = vidFromString('std::list::List')
    const ref = resolveVid(listVid, ctx, ['type-def'])
    if (!ref || ref.def.kind !== 'type-def') {
        addError(ctx, notFoundError(ctx, listExpr, vidToString(listVid)))
        listExpr.type = unknownType
        return
    }
    listExpr.type = { kind: 'vid-type', identifier: listVid, typeArgs: [itemType] }
}

export const checkAssignExpr = (binaryExpr: BinaryExpr, ctx: Context): void => {
    // TODO: make a special type that is not allowed to be used, same for loop expr return type
    binaryExpr.type = unknownType
    checkOperand(binaryExpr.lOperand, ctx)
    checkOperand(binaryExpr.rOperand, ctx)
    const assigneeType = binaryExpr.lOperand.type!
    const valueType = binaryExpr.rOperand.type!
    if (!isAssignable(valueType, assigneeType, ctx)) {
        addError(ctx, typeError(ctx, binaryExpr, valueType, assigneeType))
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
    const instanceMap = instScope ? instanceGenericMap(instScope.def, ctx) : new Map()
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
