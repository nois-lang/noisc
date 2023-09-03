import { AstNode, Module, Param } from '../ast'
import { BinaryExpr, Expr, UnaryExpr } from '../ast/expr'
import { CallOp, ConOp } from '../ast/op'
import { Identifier, Operand } from '../ast/operand'
import { Block, FnDef, ImplDef, Statement, TraitDef, VarDef } from '../ast/statement'
import { Generic, Type } from '../ast/type'
import { TypeCon, TypeDef } from '../ast/type-def'
import { Context, ImplScope, TypeDefScope, defKey, instanceScope } from '../scope'
import { getImplTargetType, traitDefToVirtualType } from '../scope/trait'
import { idToVid, vidFromString, vidToString } from '../scope/util'
import { Definition, resolveVid } from '../scope/vid'
import {
    Typed,
    VidType,
    VirtualFnType,
    VirtualType,
    genericToVirtual,
    isAssignable,
    typeError,
    typeToVirtual,
    virtualTypeToString
} from '../typecheck'
import { resolveFnGenerics, resolveInstanceGenerics, resolveType } from '../typecheck/generic'
import { selfType, unitType, unknownType } from '../typecheck/type'
import { todo } from '../util/todo'
import { notFoundError, semanticError } from './error'
import { checkAccessExpr } from './instance'
import { operatorImplMap } from './op'
import { useExprToVids } from './use-expr'

export const checkModule = (module: Module, ctx: Context, brief: boolean = false): void => {
    if (brief && module.briefed) return
    if (module.checked) return
    module.briefed = true
    if (!brief) {
        module.checked = true
    }

    if (ctx.moduleStack.length > 100) {
        const vid = vidToString(module.identifier)
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
}

const checkBlock = (block: Block, ctx: Context, brief: boolean = false): void => {
    const module = ctx.moduleStack.at(-1)!
    module.scopeStack.push({ kind: 'block', definitions: new Map() })

    block.statements.forEach(s => checkStatement(s, ctx, true))
    if (!brief) {
        block.statements.forEach(s => checkStatement(s, ctx))
    }

    const topLevel = module.scopeStack.length === 1
    if (topLevel && !module.topScope) {
        module.topScope = module.scopeStack.at(-1)!
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
    if (['impl-def', 'trait-def'].includes(scope.kind) && statement.kind !== 'fn-def') {
        ctx.errors.push(semanticError(ctx, statement, `\`${statement.kind}\` in instance scope is not allowed`))
        return
    }

    const pushDefToStack = (def: Definition) => {
        scope.definitions.set(defKey(def), def)
    }

    switch (statement.kind) {
        case 'var-def':
            checkVarDef(statement, ctx, brief)
            pushDefToStack(statement)
            break
        case 'fn-def':
            checkFnDef(statement, ctx, brief)
            pushDefToStack(statement)
            break
        case 'trait-def':
            checkTraitDef(statement, ctx, brief)
            pushDefToStack(statement)
            break
        case 'impl-def':
            checkImplDef(statement, ctx, brief)
            pushDefToStack(statement)
            break
        case 'type-def':
            checkTypeDef(statement, ctx, brief)
            pushDefToStack(statement)
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
    module.scopeStack.push({ kind: 'fn-def', definitions: new Map(fnDef.generics.map(g => [defKey(g), g])) })

    const paramTypes = fnDef.params.map((p, i) => {
        checkParam(p, i, ctx)
        return p.type!
    })

    fnDef.type = {
        kind: 'fn-type',
        generics: fnDef.generics.map(g => genericToVirtual(g, ctx)),
        paramTypes,
        returnType: fnDef.returnType ? typeToVirtual(fnDef.returnType, ctx) : unitType
    }

    if (!brief) {
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

        if (fnDef.returnType) {
            checkType(fnDef.returnType, ctx)
        }

        if (fnDef.block) {
            checkBlock(fnDef.block, ctx)
        } else {
            if (instanceScope(ctx)?.kind !== 'trait-def') {
                ctx.warnings.push(semanticError(ctx, fnDef, `fn \`${fnDef.name.value}\` has no body -> must be native`))
            }
        }
    }

    module.scopeStack.pop()
}

const checkParam = (param: Param, index: number, ctx: Context): void => {
    if (param.type) return

    const module = ctx.moduleStack.at(-1)!
    const instScope = instanceScope(ctx)

    if (!param.paramType) {
        if (index === 0 && instScope && param.pattern.kind === 'name' && param.pattern.value === 'self') {
            param.type = instScope.selfType
        } else {
            ctx.errors.push(semanticError(ctx, param, 'parameter type not specified'))
            param.type = unknownType
        }
    } else {
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

    module.scopeStack.at(-1)!.definitions.set(defKey(param), param)
}

const checkTraitDef = (traitDef: TraitDef, ctx: Context, brief: boolean = false) => {
    const module = ctx.moduleStack.at(-1)!

    if (instanceScope(ctx)) {
        ctx.errors.push(semanticError(ctx, traitDef, `\`${traitDef.kind}\` within instance scope`))
        return
    }

    const selfType = traitDefToVirtualType(traitDef, ctx)
    module.scopeStack.push({
        kind: 'trait-def',
        selfType,
        def: traitDef,
        definitions: new Map(traitDef.generics.map(g => [defKey(g), g]))
    })

    traitDef.type = selfType

    checkBlock(traitDef.block, ctx, brief)

    module.scopeStack.pop()
}

const checkImplDef = (implDef: ImplDef, ctx: Context, brief: boolean = false) => {
    const module = ctx.moduleStack.at(-1)!

    if (instanceScope(ctx)) {
        ctx.errors.push(semanticError(ctx, implDef, 'impl definition within instance scope'))
        return
    }

    module.scopeStack.push({
        kind: 'impl-def',
        selfType: unknownType,
        def: implDef,
        definitions: new Map(implDef.generics.map(g => [defKey(g), g]))
    })
    const selfType = getImplTargetType(implDef, ctx);
    // must be set afterwards since impl generics cannot be resolved
    (<ImplScope>module.scopeStack.at(-1)!).selfType = selfType

    implDef.type = selfType

    if (!brief) {
        if (implDef.forTrait) {
            checkIdentifier(implDef.forTrait, ctx)
        }
        checkIdentifier(implDef.identifier, ctx)
    }

    checkBlock(implDef.block, ctx, brief)

    module.scopeStack.pop()
}

const checkTypeDef = (typeDef: TypeDef, ctx: Context, brief: boolean = false) => {
    const module = ctx.moduleStack.at(-1)!

    if (instanceScope(ctx)) {
        ctx.errors.push(semanticError(ctx, typeDef, 'type definition within instance scope'))
        return
    }

    const vid = { names: [...module.identifier.names, typeDef.name.value] }
    module.scopeStack.push({
        kind: 'type-def',
        def: typeDef,
        vid,
        definitions: new Map(typeDef.generics.map(g => [defKey(g), g]))
    })

    typeDef.variants.forEach(v => checkTypeCon(v, ctx))
    // TODO: check duplicate type cons

    typeDef.type = {
        kind: 'vid-type',
        identifier: vid,
        typeArgs: typeDef.generics.map(g => genericToVirtual(g, ctx))
    }

    module.scopeStack.pop()
}

const checkTypeCon = (typeCon: TypeCon, ctx: Context) => {
    if (typeCon.type) return

    const module = ctx.moduleStack.at(-1)!
    const typeDefScope = <TypeDefScope>module.scopeStack.at(-1)!
    typeCon.fieldDefs.forEach(fieldDef => {
        checkType(fieldDef.fieldType, ctx)
        // TODO: check duplicate field defs
    })
    const generics = [...typeDefScope.definitions.values()]
        .map(d => <Generic>d)
        .map(g => genericToVirtual(g, ctx))
    typeCon.type = {
        kind: 'fn-type',
        paramTypes: typeCon.fieldDefs.map(f => typeToVirtual(f.fieldType, ctx)),
        returnType: { kind: 'vid-type', identifier: typeDefScope.vid, typeArgs: generics },
        generics
    }
}

const checkVarDef = (varDef: VarDef, ctx: Context, brief: boolean = false): void => {
    if (brief && varDef.type) return
    const topLevel = ctx.moduleStack.at(-1)!.scopeStack.length === 1

    if (topLevel) {
        if (!varDef.varType) {
            ctx.errors.push(semanticError(ctx, varDef, `top level \`${varDef.kind}\` must have explicit type`))
            return
        }
    }

    if (varDef.varType) {
        checkType(varDef.varType, ctx)
        varDef.type = resolveType(typeToVirtual(varDef.varType, ctx), [resolveInstanceGenerics(ctx)], varDef, ctx)
    }

    if (brief) return

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

    const fnType = <VirtualFnType>operand.type
    const typeArgs = operand.kind === 'identifier' && operand.typeArgs.length > 0
        ? operand.typeArgs.map(tp => typeToVirtual(tp, ctx))
        : undefined
    const instanceGenericMap = resolveInstanceGenerics(ctx)
    const fnGenericMap = resolveFnGenerics(fnType, callOp.args.map(a => a.type!), typeArgs)
    const paramTypes = fnType.paramTypes.map((pt, i) => resolveType(
        pt,
        [instanceGenericMap, fnGenericMap],
        callOp.args.at(i) ?? unaryExpr,
        ctx
    ))
    checkCallArgs(callOp, callOp.args, paramTypes, ctx)

    unaryExpr.type = resolveType(fnType.returnType, [instanceGenericMap, fnGenericMap], unaryExpr, ctx)
}

// TODO: allow non-prefixed constructor expressions for single-variant types, e.g. Unit() instead of Unit::Unit()
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
    conOp.fields.map(f => checkExpr(f.expr, ctx))
    // TODO: check con expr
    const typeCon = ref.def.typeCon
    const typeConType = <VirtualFnType>typeCon.type!
    // TODO: figure out typeArgs parameter here
    // TODO: fields might be specified out of order, match conOp.fields by name 
    const genericMap = resolveFnGenerics(typeConType, conOp.fields.map(f => f.expr.type!))
    typeConType.generics.forEach(g => {
        if (!genericMap.get(g.name)) {
            // TODO: find actual con op argument that's causing this
            ctx.errors.push(semanticError(ctx, conOp, `unresolved type parameter ${g.name}`))
        }
    })
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

    const implFn = <FnDef>resolveVid(opImplFnId, ctx, ['fn-def'])?.def
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
                kind: 'vid-type',
                identifier: resolveVid(vidFromString('String'), ctx)!.vid,
                typeArgs: []
            }
            break
        case 'char-literal':
            operand.type = {
                kind: 'vid-type',
                identifier: resolveVid(vidFromString('Char'), ctx)!.vid,
                typeArgs: []
            }
            break
        case 'int-literal':
            operand.type = {
                kind: 'vid-type',
                identifier: resolveVid(vidFromString('Int'), ctx)!.vid,
                typeArgs: []
            }
            break
        case 'float-literal':
            operand.type = {
                kind: 'vid-type',
                identifier: resolveVid(vidFromString('Float'), ctx)!.vid,
                typeArgs: []
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
    if (ref) {
        if ('type' in ref.def && ref.def.type) {
            identifier.type = ref.def.type
        }
    } else {
        ctx.errors.push(notFoundError(ctx, identifier, vidToString(vid)))
        identifier.type = unknownType
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
            type.typeArgs.forEach(tp => checkType(tp, ctx))
            return
        case 'type-bounds':
            // TODO
            break
        case 'fn-type':
            // TODO
            break
    }
}

export const checkCallArgs = (
    node: AstNode<any>,
    args: (AstNode<any> & Partial<Typed>)[],
    paramTypes: VirtualType[],
    ctx: Context
): void => {
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
