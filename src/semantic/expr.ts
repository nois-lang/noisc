import { checkBlock, checkCallArgs, checkIdentifier, checkParam, checkType } from '.'
import { BinaryExpr, Expr, UnaryExpr } from '../ast/expr'
import { MatchExpr } from '../ast/match'
import { CallOp, ConOp } from '../ast/op'
import { ClosureExpr, ForExpr, IfExpr, IfLetExpr, ListExpr, Operand, WhileExpr } from '../ast/operand'
import { Context, instanceScope } from '../scope'
import { bool, iter, iterable } from '../scope/std'
import { getImplTargetType } from '../scope/trait'
import { idToVid, vidFromString, vidToString } from '../scope/util'
import { MethodDef, resolveVid } from '../scope/vid'
import {
    VidType,
    VirtualFnType,
    isAssignable,
    typeToVirtual,
    virtualTypeToString
} from '../typecheck'
import { instanceGenericMap, resolveFnGenerics, resolveGenericsOverStructure, resolveType } from '../typecheck/generic'
import { unitType, unknownType } from '../typecheck/type'
import { assert, todo } from '../util/todo'
import { notFoundError, semanticError, typeError } from './error'
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
        case 'identifier':
            checkIdentifier(operand, ctx)
            if (!operand.type) {
                ctx.errors.push(semanticError(ctx, operand, `unknown type of identifier \`${vidToString(idToVid(operand))}\``))
            }
            break
    }
    if (!operand.type) {
        operand.type = unknownType
    }
}

export const checkUnaryExpr = (unaryExpr: UnaryExpr, ctx: Context): void => {
    switch (unaryExpr.unaryOp.kind) {
        case 'call-op':
            checkCallExpr(unaryExpr, ctx)
            break
        case 'con-op':
            checkConExpr(unaryExpr, ctx)
            break
        case 'neg-op':
            // todo
            break
        case 'not-op':
            // todo
            break
        case 'spread-op':
            // todo
            break
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

    // TODO: make sure method is callable on the lOperand type, e.g. !5 -> Not::not(5) should fail
    const methodRef = <MethodDef>resolveVid(opImplFnVid!, ctx, ['method-def'])?.def
    assert(!!methodRef, `impl fn \`${vidToString(opImplFnVid!)}\` not found`)
    assert(!!methodRef.fn.type, 'untyped impl fn')
    assert(methodRef.fn.type!.kind === 'fn-type', 'impl fn type in not fn')

    const implTargetType = getImplTargetType(methodRef.trait, ctx)
    // TODO: lOperand acts as a type args provider for generics. Improve it
    const implGenericMap = resolveGenericsOverStructure(binaryExpr.lOperand.type!, implTargetType)
    const fnType = <VirtualFnType>methodRef.fn.type
    const fnGenericMap = resolveFnGenerics(
        fnType,
        [binaryExpr.lOperand.type ?? unknownType, binaryExpr.rOperand.type ?? unknownType],
        [],
    )
    // TODO: this whole logic with generic resoluion should be unified across
    // checkBinaryExpr, checkCallExpr, checkMethodCallExpr, etc.
    const genericMaps = [implGenericMap, fnGenericMap]
    const paramTypes = fnType.paramTypes.map((pt, i) => resolveType(
        pt,
        genericMaps,
        [binaryExpr.lOperand, binaryExpr.rOperand].at(i) ?? binaryExpr,
        ctx
    ))
    checkCallArgs(binaryExpr, [binaryExpr.lOperand, binaryExpr.rOperand], paramTypes, ctx)
    binaryExpr.type = resolveType(fnType.returnType, genericMaps, binaryExpr, ctx)
}

export const checkIfExpr = (ifExpr: IfExpr, ctx: Context): void => {
    checkExpr(ifExpr.condition, ctx)
    const condType = ifExpr.condition.type ?? unknownType
    if (!isAssignable(condType, bool, ctx)) {
        ctx.errors.push(typeError(ifExpr.condition, condType, bool, ctx))
    }
    checkBlock(ifExpr.thenBlock, ctx)
    if (ifExpr.elseBlock) {
        checkBlock(ifExpr.elseBlock, ctx)

        // TODO: combine types
        const thenType = virtualTypeToString(ifExpr.thenBlock.type ?? unknownType)
        const elseType = virtualTypeToString(ifExpr.elseBlock.type ?? unknownType)
        if (thenType !== elseType) {
            ctx.errors.push(semanticError(ctx, ifExpr, `\
if branches have incompatible types:
    then: \`${thenType}\`
    else: \`${elseType}\``))


            ifExpr.type = unknownType
            return
        }
    }


    ifExpr.type = ifExpr.thenBlock.type
}

export const checkIfLetExpr = (ifLetExpr: IfLetExpr, ctx: Context): void => {
    const module = ctx.moduleStack.at(-1)!
    module.scopeStack.push({ kind: 'block', definitions: new Map() })

    checkExpr(ifLetExpr.expr, ctx)
    assert(!!ifLetExpr.expr.type)
    // pattern definitions should only be available in `then` block
    checkPattern(ifLetExpr.pattern, ifLetExpr.expr.type!, ctx)

    checkBlock(ifLetExpr.thenBlock, ctx)
    assert(!!ifLetExpr.thenBlock.type)

    module.scopeStack.pop()

    if (ifLetExpr.elseBlock) {
        checkBlock(ifLetExpr.elseBlock, ctx)
        assert(!!ifLetExpr.elseBlock.type)
        const thenType = ifLetExpr.thenBlock.type!
        const elseType = ifLetExpr.elseBlock.type!
        if (!isAssignable(elseType, thenType, ctx)) {
            // TODO: type errors with description
            ctx.errors.push(typeError(ifLetExpr, elseType, thenType, ctx))
        }
        // TODO: combine type
        ifLetExpr.type = thenType
    }
    // TODO: throw error if result of partial if let expr (no else block) is used
    ifLetExpr.type = unknownType
}

export const checkWhileExpr = (whileExpr: WhileExpr, ctx: Context): void => {
    checkExpr(whileExpr.condition, ctx)
    const condType = whileExpr.condition.type
    assert(!!condType)
    if (!isAssignable(condType!, bool, ctx)) {
        ctx.errors.push(typeError(whileExpr.condition, condType!, bool, ctx))
    }

    checkBlock(whileExpr.block, ctx)
    assert(!!whileExpr.block.type)

    whileExpr.type = {
        kind: 'vid-type',
        identifier: iter.identifier,
        typeArgs: [whileExpr.block.type!]
    }
}

export const checkForExpr = (forExpr: ForExpr, ctx: Context): void => {
    const module = ctx.moduleStack.at(-1)!
    module.scopeStack.push({ kind: 'block', definitions: new Map() })

    checkExpr(forExpr.expr, ctx)
    assert(!!forExpr.expr.type)
    if (![iter, iterable].some(t => isAssignable(forExpr.expr.type!, t, ctx))) {
        ctx.errors.push(semanticError(ctx, forExpr.expr, `type ${virtualTypeToString(forExpr.expr.type!)} is not iterable`))
    }

    // TODO: need function to extract trait from concrete type in order to resolve generic, 
    // e.g. extractTrait(`Iterable`, `List<Int>`) -> Iterable<Int>
    checkPattern(forExpr.pattern, unknownType, ctx)

    checkBlock(forExpr.block, ctx)
    assert(!!forExpr.block.type)

    forExpr.type = {
        kind: 'vid-type',
        identifier: iter.identifier,
        typeArgs: [forExpr.block.type!]
    }

    module.scopeStack.pop()
}

export const checkMatchExpr = (matchExpr: MatchExpr, ctx: Context): void => {
    const errors = ctx.errors.length

    checkExpr(matchExpr.expr, ctx)
    matchExpr.clauses.forEach(clause => {
        checkPattern(clause.pattern, matchExpr.expr.type ?? unknownType, ctx)
        if (clause.guard) {
            checkExpr(clause.guard, ctx)
            const guardType = clause.guard.type ?? unknownType
            if (guardType.kind !== 'vid-type' || !isAssignable(guardType, bool, ctx)) {
                ctx.errors.push(typeError(clause.guard, guardType, bool, ctx))
            }
        }
        checkBlock(clause.block, ctx)
    })
    // exhaustion assumes that every pattern is semantically correct, so run it only when no errors were found in the
    // matchExpr
    if (errors === ctx.errors.length) {
        checkExhaustion(matchExpr, ctx)
    }
}

/**
 * TODO: provide expected type hint, e.g. varDef type or param type where closure is passed as arg
 */
export const checkClosureExpr = (closureExpr: ClosureExpr, ctx: Context): void => {
    if (closureExpr.params.some(p => !p.paramType)) {
        // one approach is to assign every untyped parameter a generic that will be resolved once closure is called
        // with args, e.g. `|a, b| { a + b }` will have type <A, B>|a: A, b: B|: ?
        // no idea what to do with the return type though
        todo("infer closure param types")
    }
    if (!closureExpr.returnType) {
        todo("infer closure return type")
    }

    const module = ctx.moduleStack.at(-1)!
    // TODO: closure generics
    module.scopeStack.push({ kind: 'fn', definitions: new Map(), def: closureExpr, returnStatements: [] })

    closureExpr.params.forEach((p, i) => checkParam(p, i, ctx))
    checkType(closureExpr.returnType!, ctx)
    checkBlock(closureExpr.block, ctx)
    // TODO: typecheck block -> return type

    closureExpr.type = {
        kind: 'fn-type',
        paramTypes: closureExpr.params.map(p => typeToVirtual(p.paramType!, ctx)),
        returnType: typeToVirtual(closureExpr.returnType!, ctx),
        generics: []
    }

    module.scopeStack.pop()
}

/**
 * TODO: call parameterless variant, e.g. Option::None()
 * TODO: better error when variant is called as a function, e.g. Option::Some(4)
 */
export const checkCallExpr = (unaryExpr: UnaryExpr, ctx: Context): void => {
    const callOp = <CallOp>unaryExpr.unaryOp
    const operand = unaryExpr.operand

    checkOperand(operand, ctx)

    if (operand.type?.kind !== 'fn-type') {
        const message = `type error: non-callable operand of type \`${virtualTypeToString(operand.type!)}\``
        ctx.errors.push(semanticError(ctx, operand, message))
        return
    }
    callOp.args.forEach(a => checkOperand(a, ctx))

    const fnType = <VirtualFnType>operand.type
    const typeArgs = operand.kind === 'identifier'
        ? operand.typeArgs.map(tp => typeToVirtual(tp, ctx))
        : []
    const instScope = instanceScope(ctx)
    const instanceMap = instScope ? instanceGenericMap(instScope, ctx) : new Map()
    const fnGenericMap = resolveFnGenerics(fnType, callOp.args.map(a => a.type!), typeArgs)
    const paramTypes = fnType.paramTypes.map((pt, i) => resolveType(
        pt,
        [instanceMap, fnGenericMap],
        callOp.args.at(i) ?? unaryExpr,
        ctx
    ))
    checkCallArgs(callOp, callOp.args, paramTypes, ctx)

    unaryExpr.type = resolveType(fnType.returnType, [instanceMap, fnGenericMap], unaryExpr, ctx)
}

export const checkConExpr = (unaryExpr: UnaryExpr, ctx: Context): void => {
    const conOp = <ConOp>unaryExpr.unaryOp
    const operand = unaryExpr.operand
    if (operand.kind !== 'identifier') {
        ctx.errors.push(semanticError(ctx, operand, `expected identifier, got ${operand.kind}`))
        return
    }
    checkOperand(operand, ctx)
    const vid = idToVid(operand)
    const ref = resolveVid(vid, ctx)
    if (!ref) {
        ctx.errors.push(notFoundError(ctx, operand, vidToString(vid)))
        return
    }
    if (ref.def.kind !== 'variant') {
        ctx.errors.push(semanticError(
            ctx,
            operand,
            `type error: ${virtualTypeToString(operand.type!)} is not a variant`
        ))
        return
    }
    conOp.fields.map(f => checkExpr(f.expr, ctx))
    const variant = ref.def.variant
    const variantType = <VirtualFnType>variant.type!
    // TODO: figure out typeArgs parameter here
    // TODO: fields might be specified out of order, match conOp.fields by name 
    const genericMap = resolveFnGenerics(
        variantType,
        conOp.fields.map(f => f.expr.type ?? unknownType),
        operand.typeArgs.map(t => typeToVirtual(t, ctx))
    )
    variantType.generics.forEach(g => {
        if (!genericMap.get(g.name)) {
            // TODO: find actual con op argument that's causing this
            ctx.errors.push(semanticError(ctx, conOp, `unresolved type parameter ${g.name}`))
        }
    })
    if (variantType.paramTypes.length !== conOp.fields.length) {
        ctx.errors.push(semanticError(ctx, conOp, `expected ${variantType.paramTypes.length} arguments, got ${conOp.fields.length}`))
        return
    }
    variantType.paramTypes
        .map(pt => resolveType(pt, [genericMap], variant, ctx))
        .forEach((paramType, i) => {
            // TODO: fields might be specified out of order, match conOp.fields by name 
            const field = conOp.fields[i]
            const argType = resolveType(field.expr.type ?? unknownType, [genericMap], field, ctx)
            if (!isAssignable(argType, paramType, ctx)) {
                ctx.errors.push(typeError(field, argType, paramType, ctx))
            }
        })
    unaryExpr.type = {
        kind: 'vid-type',
        identifier: (<VidType>variantType.returnType).identifier,
        typeArgs: variantType.generics.map(g => resolveType(g, [genericMap], unaryExpr, ctx))
    }
}

export const checkListExpr = (listExpr: ListExpr, ctx: Context): void => {
    listExpr.exprs.forEach(e => checkExpr(e, ctx))
    listExpr.type = {
        kind: 'vid-type',
        identifier: vidFromString('std::list::List'),
        // TODO: combine items types
        typeArgs: [listExpr.exprs.at(0)?.type ?? unknownType]
    }
}

export const checkAssignExpr = (binaryExpr: BinaryExpr, ctx: Context): void => {
    binaryExpr.type = unitType
    checkOperand(binaryExpr.lOperand, ctx)
    checkOperand(binaryExpr.rOperand, ctx)
    // TODO: check assignability
    const assigneeType = binaryExpr.lOperand.type ?? unknownType
    const valueType = binaryExpr.rOperand.type ?? unknownType
    if (!isAssignable(valueType, assigneeType, ctx)) {
        ctx.errors.push(typeError(binaryExpr, valueType, assigneeType, ctx))
    }
}
