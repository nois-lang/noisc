import { checkBlock, checkCallArgs, checkIdentifier, checkParam, checkType } from '.'
import { BinaryExpr, Expr, UnaryExpr } from '../ast/expr'
import { MatchExpr } from '../ast/match'
import { CallOp, ConOp } from '../ast/op'
import { ClosureExpr, IfExpr, ListExpr, Operand } from '../ast/operand'
import { Context, instanceScope } from '../scope'
import { bool } from '../scope/std'
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
import { unknownType } from '../typecheck/type'
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
            // TODO
            break
        case 'while-expr':
            // TODO
            break
        case 'for-expr':
            // TODO
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
        // TODO
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
    if (condType.kind !== 'vid-type' || !isAssignable(condType, bool, ctx)) {
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

export const checkMatchExpr = (matchExpr: MatchExpr, ctx: Context): void => {
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
    checkExhaustion(matchExpr, ctx)
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
 * TODO: call parameterless typeCon, e.g. Option::None()
 * TODO: better error when type-con is called as a function, e.g. Option::Some(4)
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
    if (ref.def.kind !== 'type-con') {
        ctx.errors.push(semanticError(
            ctx,
            operand,
            `type error: ${virtualTypeToString(operand.type!)} is not a variant type constructor`
        ))
        return
    }
    conOp.fields.map(f => checkExpr(f.expr, ctx))
    const typeCon = ref.def.typeCon
    const typeConType = <VirtualFnType>typeCon.type!
    // TODO: figure out typeArgs parameter here
    // TODO: fields might be specified out of order, match conOp.fields by name 
    const genericMap = resolveFnGenerics(
        typeConType,
        conOp.fields.map(f => f.expr.type!),
        operand.typeArgs.map(t => typeToVirtual(t, ctx))
    )
    typeConType.generics.forEach(g => {
        if (!genericMap.get(g.name)) {
            // TODO: find actual con op argument that's causing this
            ctx.errors.push(semanticError(ctx, conOp, `unresolved type parameter ${g.name}`))
        }
    })
    if (typeConType.paramTypes.length !== conOp.fields.length) {
        ctx.errors.push(semanticError(ctx, conOp, `expected ${typeConType.paramTypes.length} arguments, got ${conOp.fields.length}`))
        return
    }
    typeConType.paramTypes
        .map(pt => resolveType(pt, [genericMap], typeCon, ctx))
        .forEach((paramType, i) => {
            // TODO: fields might be specified out of order, match conOp.fields by name 
            const field = conOp.fields[i]
            const argType = resolveType(field.expr.type!, [genericMap], field, ctx)
            if (!isAssignable(argType, paramType, ctx)) {
                ctx.errors.push(typeError(field, argType, paramType, ctx))
            }
        })
    unaryExpr.type = {
        kind: 'vid-type',
        identifier: (<VidType>typeConType.returnType).identifier,
        typeArgs: typeConType.generics.map(g => resolveType(g, [genericMap], unaryExpr, ctx))
    }
}

export const checkListExpr = (listExpr: ListExpr, ctx: Context): void => {
    listExpr.exprs.forEach(e => checkExpr(e, ctx))
    listExpr.type = {
        kind: 'vid-type',
        identifier: vidFromString('std::list::List'),
        // TODO: calculate common type across items
        typeArgs: [listExpr.exprs.at(0)?.type ?? unknownType]
    }
}

