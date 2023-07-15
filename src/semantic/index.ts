import { Context, defKey, findImpl, findImplFn, instanceScope } from '../scope'
import { AstNode, Module, Param } from '../ast'
import { Block, FnDef, ImplDef, Statement, TraitDef, VarDef } from '../ast/statement'
import { BinaryExpr, Expr, UnaryExpr } from '../ast/expr'
import { operatorImplMap } from './op'
import { Identifier, Operand } from '../ast/operand'
import {
    genericToVirtual,
    isAssignable,
    selfType,
    Typed,
    typeError,
    typeToVirtual,
    unitType,
    unknownType,
    VirtualFnType,
    VirtualType,
    virtualTypeToString
} from '../typecheck'
import { CallOp, ConOp } from '../ast/op'
import { concatVid, Definition, idToVid, resolveVid, vidFromScope, vidFromString, vidToString } from '../scope/vid'
import { useExprToVids } from './use-expr'
import { Type } from '../ast/type'
import { notFoundError, semanticError } from './error'
import { todo } from '../util/todo'
import { checkAccessExpr } from './access'
import { getImplTargetType, traitDefToTypeDefType } from '../scope/trait'
import { TypeCon, TypeDef } from '../ast/type-def'
import { resolveFnGenerics, resolveInstanceGenerics } from '../typecheck/generic'

export const checkModule = (module: Module, ctx: Context, brief: boolean = false): void => {
    if (module.checked) return
    const vid = vidToString(module.identifier)
    if (ctx.moduleStack.length > 100) {
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
    const module = ctx.moduleStack.at(-1)!
    const scope = module.scopeStack.at(-1)!
    const topLevel = module.scopeStack.length === 1

    if (topLevel && !['var-def', 'fn-def', 'trait-def', 'impl-def', 'type-def'].includes(statement.kind)) {
        ctx.errors.push(semanticError(ctx, statement, `top level \`${statement.kind}\` is not allowed`))
        return
    }
    if (['impl-def', 'trait-def'].includes(scope.type) && statement.kind !== 'fn-def') {
        ctx.errors.push(semanticError(ctx, statement, `\`${statement.kind}\` in instance scope is not allowed`))
        return
    }

    const pushDefToStack = () => {
        if (topLevel || brief) {
            const def = <Definition>statement
            scope.definitions.set(defKey(def), def)
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
        case 'trait-def':
            // todo
            checkTraitDef(statement, ctx, brief)
            pushDefToStack()
            break
        case 'impl-def':
            // todo
            checkImplDef(statement, ctx, brief)
            pushDefToStack()
            break
        case 'type-def':
            // todo
            if (!brief) break
            checkTypeDef(statement, ctx)
            pushDefToStack()
            break
        case 'operand-expr':
        case 'unary-expr':
        case 'binary-expr':
            if (!brief) {
                checkExpr(statement, ctx)
            }
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
            break
        case 'binary-expr':
            checkBinaryExpr(expr, ctx)
            break
    }
}

const checkFnDef = (fnDef: FnDef, ctx: Context, brief: boolean = false): void => {
    const module = ctx.moduleStack.at(-1)!
    module.scopeStack.push({ type: 'fn-def', definitions: new Map(fnDef.generics.map(g => [defKey(g), g])) })

    const paramTypes = fnDef.params.map((p, i) => {
        checkParam(p, i, ctx)
        return p.type!
    })

    fnDef.params.forEach(p => {
        switch (p.pattern.kind) {
            case 'hole':
                break
            case 'name':
                module.scopeStack.at(-1)!.definitions.set(defKey(p), p)
                break
            case 'con-pattern':
                todo('add con-pattern to scope')
                break
        }
    })

    if (fnDef.returnType && brief) {
        checkType(fnDef.returnType, ctx)
    }

    fnDef.type = {
        kind: 'fn-type',
        generics: fnDef.generics.map(g => genericToVirtual(g, ctx)),
        paramTypes,
        returnType: fnDef.returnType ? typeToVirtual(fnDef.returnType, ctx) : unitType
    }

    if (!brief) {
        if (!fnDef.block) {
            if (instanceScope(ctx)?.type !== 'trait-def') {
                ctx.warnings.push(semanticError(ctx, fnDef, `fn \`${fnDef.name.value}\` has no body -> must be native`))
            }
        } else {
            checkBlock(fnDef.block, ctx)
        }
    }

    module.scopeStack.pop()
}

const checkParam = (param: Param, index: number, ctx: Context): void => {
    if (param.type) return
    if (!param.paramType) {
        const instScope = instanceScope(ctx)
        if (index === 0 && instScope && param.pattern.kind === 'name' && param.pattern.value === 'self') {
            param.type = instScope.selfType
        } else {
            ctx.errors.push(semanticError(ctx, param, 'parameter type not specified'))
            param.type = unknownType
        }
    } else {
        const instScope = instanceScope(ctx)
        checkType(param.paramType, ctx)
        if (instScope && param.paramType.kind === 'identifier' && param.paramType.name.value === selfType.name) {
            param.type = instScope.selfType
        } else {
            param.type = typeToVirtual(param.paramType, ctx)
        }
    }
    switch (param.pattern.kind) {
        case 'operand-expr':
        case 'unary-expr':
        case 'binary-expr':
            ctx.errors.push(semanticError(ctx, param.pattern, `\`${param.pattern.kind}\` can only be used in match expressions`))
    }
}

const checkTraitDef = (traitDef: TraitDef, ctx: Context, brief: boolean = false) => {
    const module = ctx.moduleStack.at(-1)!

    if (instanceScope(ctx)) {
        ctx.errors.push(semanticError(ctx, traitDef, `\`${traitDef.kind}\` within instance scope`))
        return
    }

    module.scopeStack.push({
        type: 'trait-def',
        selfType: traitDefToTypeDefType(traitDef, ctx),
        def: traitDef,
        definitions: new Map(traitDef.generics.map(g => [defKey(g), g]))
    })

    checkBlock(traitDef.block, ctx, brief)

    module.scopeStack.pop()
}

const checkImplDef = (implDef: ImplDef, ctx: Context, brief: boolean = false) => {
    const module = ctx.moduleStack.at(-1)!

    if (instanceScope(ctx)) {
        ctx.errors.push(semanticError(ctx, implDef, `\`${implDef.kind}\` within instance scope`))
        return
    }

    module.scopeStack.push({
        type: 'impl-def',
        selfType: getImplTargetType(implDef, ctx),
        def: implDef,
        definitions: new Map(implDef.generics.map(g => [defKey(g), g]))
    })

    if (!brief) {
        checkBlock(implDef.block, ctx)
    }

    module.scopeStack.pop()
}

const checkTypeDef = (typeDef: TypeDef, ctx: Context) => {
    const module = ctx.moduleStack.at(-1)!

    if (instanceScope(ctx)) {
        ctx.errors.push(semanticError(ctx, typeDef, `\`${typeDef.kind}\` within instance scope`))
        return
    }

    module.scopeStack.push({ type: 'type-def', definitions: new Map(typeDef.generics.map(g => [defKey(g), g])) })

    typeDef.type = {
        kind: 'type-def',
        identifier: concatVid(module.identifier, vidFromString(typeDef.name.value)),
        generics: typeDef.generics.map(g => genericToVirtual(g, ctx))
    }

    typeDef.variants.forEach(v => checkTypeCon(v, typeDef, ctx))
    // TODO: check duplicate type cons

    module.scopeStack.pop()
}

const checkTypeCon = (typeCon: TypeCon, typeDef: TypeDef, ctx: Context) => {
    typeCon.fieldDefs.forEach(fieldDef => {
        checkType(fieldDef.fieldType, ctx)
        // TODO: check duplicate field defs
    })
    typeCon.type = {
        kind: 'fn-type',
        paramTypes: typeCon.fieldDefs.map(f => typeToVirtual(f.fieldType, ctx)),
        returnType: typeDef.type ?? unknownType,
        generics: typeDef.generics.map(g => genericToVirtual(g, ctx))
    }
}

const checkVarDef = (varDef: VarDef, ctx: Context, brief: boolean = false): void => {
    if (brief && varDef.type) return
    const topLevel = ctx.moduleStack.at(-1)!.scopeStack.length === 1

    if (topLevel && brief) {
        if (!varDef.varType) {
            ctx.errors.push(semanticError(ctx, varDef, `top level \`${varDef.kind}\` must have explicit type`))
            return
        }
    }

    if (varDef.varType) {
        checkType(varDef.varType, ctx)
        varDef.type = typeToVirtual(varDef.varType, ctx)
    }

    if (!brief) return

    checkExpr(varDef.expr, ctx)
    if (varDef.varType) {
        const exprType = varDef.expr.type ?? unknownType
        const varType = varDef.type ?? unknownType
        if (!isAssignable(exprType, varType, ctx)) {
            ctx.errors.push(typeError(varDef, exprType, varType, ctx))
        }
    } else {
        varDef.type = varDef.expr.type
    }
}

const checkUnaryExpr = (unaryExpr: UnaryExpr, ctx: Context): void => {
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

/**
 * TODO: fix false positive
 * TODO: better error when type-con is called as a function, e.g. Option::Some(4)
 */
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

    const instanceGenericMap = resolveInstanceGenerics(ctx)
    const fnType = <VirtualFnType>operand.type
    const typeArgs = operand.kind === 'identifier' ? operand.typeParams.map(tp => typeToVirtual(tp, ctx)) : []
    const genericMap = resolveFnGenerics(fnType, typeArgs, callOp.args)
    const paramTypes = fnType.paramTypes.map(pt => {
        const vt = virtualTypeToString(pt)
        return genericMap.get(vt) ?? pt
    })
    checkCallArgs(callOp, callOp.args, paramTypes, ctx)
}

const checkConExpr = (unaryExpr: UnaryExpr, ctx: Context): void => {
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
    // TODO: check con expr
    unaryExpr.type = (<VirtualFnType>ref.def.typeCon.type).returnType
}

const checkBinaryExpr = (binaryExpr: BinaryExpr, ctx: Context): void => {
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

    const opImplFnId = operatorImplMap.get(binaryExpr.binaryOp.kind)
    if (!opImplFnId) throw Error(`operator ${binaryExpr.binaryOp.kind} without impl function`)

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

    // TODO: figure out how to resolve generics without their scope
    checkCallArgs(binaryExpr, [binaryExpr.lOperand, binaryExpr.rOperand], (<VirtualFnType>implFn.type).paramTypes, ctx)
}

export const checkOperand = (operand: Operand, ctx: Context): void => {
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
            operand.type = {
                kind: 'type-def',
                identifier: resolveVid(vidFromString('String'), ctx)!.qualifiedVid,
                generics: []
            }
            break
        case 'char-literal':
            operand.type = {
                kind: 'type-def',
                identifier: resolveVid(vidFromString('Char'), ctx)!.qualifiedVid,
                generics: []
            }
            break
        case 'int-literal':
            operand.type = {
                kind: 'type-def',
                identifier: resolveVid(vidFromString('Int'), ctx)!.qualifiedVid,
                generics: []
            }
            break
        case 'float-literal':
            operand.type = {
                kind: 'type-def',
                identifier: resolveVid(vidFromString('Float'), ctx)!.qualifiedVid,
                generics: []
            }
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
        ctx.errors.push(notFoundError(ctx, identifier, vidToString(vid)))
        identifier.type = unknownType
    } else {
        identifier.type = 'type' in ref.def ? ref.def.type : unknownType
    }
}

const checkType = (type: Type, ctx: Context) => {
    switch (type.kind) {
        case 'identifier':
            const vid = idToVid(type)
            const ref = resolveVid(vid, ctx)
            if (!ref) {
                ctx.errors.push(notFoundError(ctx, type, vidToString(vid)))
                return
            }
            if (!['type-def', 'trait-def', 'generic', 'self'].includes(ref.def.kind)) {
                ctx.errors.push(semanticError(ctx, type.name, `expected type, got \`${ref.def.kind}\``))
                return
            }
            type.typeParams.forEach(tp => checkType(tp, ctx))
            // TODO: type params typecheck
            return
        case 'fn-type':
            // TODO
            break
    }
}

export const checkCallArgs = (node: AstNode<any>,
                              args: (AstNode<any> & Partial<Typed>)[],
                              paramTypes: VirtualType[],
                              ctx: Context): void => {
    if (args.length !== paramTypes.length) {
        ctx.errors.push(semanticError(ctx, node, `expected ${paramTypes.length} arguments, got ${args.length}`))
        return
    }

    for (let i = 0; i < paramTypes.length; i++) {
        const paramType = paramTypes[i]
        const arg = args[i]
        const argType = arg.type || unknownType

        if (!isAssignable(argType, paramType, ctx)) {
            ctx.errors.push(typeError(arg, argType, paramType, ctx))
        }
    }
}
