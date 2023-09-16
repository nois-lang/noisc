import { AstNode, Module, Param } from '../ast'
import { BinaryExpr, Expr, UnaryExpr } from '../ast/expr'
import { CallOp, ConOp } from '../ast/op'
import { ClosureExpr, Identifier, ListExpr, Operand } from '../ast/operand'
import { Block, FnDef, ImplDef, Statement, TraitDef, VarDef } from '../ast/statement'
import { Generic, Type } from '../ast/type'
import { TypeCon, TypeDef } from '../ast/type-def'
import { Context, InstanceScope, TypeDefScope, defKey, instanceScope } from '../scope'
import { getImplTargetType, traitDefToVirtualType } from '../scope/trait'
import { idToVid, vidFromString, vidToString } from '../scope/util'
import { Definition, MethodDef, ParamDef, resolveVid } from '../scope/vid'
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
import { instanceGenericMap, resolveFnGenerics, resolveType } from '../typecheck/generic'
import { selfType, unitType, unknownType } from '../typecheck/type'
import { assert, todo } from '../util/todo'
import { notFoundError, semanticError } from './error'
import { checkAccessExpr } from './instance'
import { operatorImplMap } from './op'
import { typeNames } from './type-def'
import { useExprToVids } from './use-expr'

export const prepareModule = (module: Module): void => {
    const defMap = new Map()
    module.block.statements.map(s => {
        switch (s.kind) {
            case 'var-def':
            case 'fn-def':
            case 'trait-def':
            case 'impl-def':
            case 'type-def':
                defMap.set(defKey(s), s)
                break
            case 'operand-expr':
            case 'unary-expr':
            case 'binary-expr':
            case 'return-stmt':
                break
        }
    })
    module.topScope = { kind: 'module', definitions: defMap }

    // TODO: check duplicate useExprs
    // TODO: check self references
    module.references = module.useExprs.flatMap(useExpr => useExprToVids(useExpr))
}

export const checkModule = (module: Module, ctx: Context): void => {
    assert(!!module.topScope, 'module top scope is not set')
    if (ctx.moduleStack.find(m => vidToString(m.identifier) === vidToString(module.identifier))) {
        const vid = vidToString(module.identifier)
        const stackVids = ctx.moduleStack.map(m => vidToString(m.identifier))
        const refChain = [...stackVids.slice(stackVids.indexOf(vid)), vid].join(' -> ')
        ctx.errors.push(semanticError(ctx, module, `circular module reference: ${refChain}`))
        return
    }
    ctx.moduleStack.push(module)

    checkBlock(module.block, ctx)

    ctx.moduleStack.pop()
}

/*
 * Can be called outside of scope, module's own scope stack is preserved
 */
export const checkTopLevelDefiniton = (module: Module, definition: Definition, ctx: Context): void => {
    assert(!!module.topScope, 'module top scope is not set')
    ctx.moduleStack.push(module)
    // since this can be called while module is still being checked and has state, it should be preserved
    const oldStack = module.scopeStack
    module.scopeStack = [module.topScope!]

    switch (definition.kind) {
        case 'type-con':
            checkTypeDef(definition.typeDef, ctx)
            break
        case 'method-def':
            // TODO: narrow to not check unrelated methods
            checkStatement(definition.trait, ctx)
            break
        case 'param':
            checkParam(definition.param, definition.index, ctx)
            break
        case 'generic':
        case 'module':
        case 'self':
            break
        default:
            checkStatement(definition, ctx)
            break
    }

    module.scopeStack = oldStack
    ctx.moduleStack.pop()
}

const checkBlock = (block: Block, ctx: Context): void => {
    const module = ctx.moduleStack.at(-1)!
    module.scopeStack.push({ kind: 'block', definitions: new Map() })

    block.statements.forEach(s => checkStatement(s, ctx))

    // TODO: block type

    module.scopeStack.pop()
}

const checkStatement = (statement: Statement, ctx: Context): void => {
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
            checkVarDef(statement, ctx)
            pushDefToStack(statement)
            break
        case 'fn-def':
            checkFnDef(statement, ctx)
            pushDefToStack(statement)
            break
        case 'trait-def':
            checkTraitDef(statement, ctx)
            pushDefToStack(statement)
            break
        case 'impl-def':
            checkImplDef(statement, ctx)
            pushDefToStack(statement)
            break
        case 'type-def':
            checkTypeDef(statement, ctx)
            pushDefToStack(statement)
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
            break
        case 'binary-expr':
            checkBinaryExpr(expr, ctx)
            break
    }
}

const checkFnDef = (fnDef: FnDef, ctx: Context): void => {
    if (fnDef.type) return

    const module = ctx.moduleStack.at(-1)!
    module.scopeStack.push({ kind: 'fn', definitions: new Map(fnDef.generics.map(g => [defKey(g), g])) })

    const paramTypes = fnDef.params.map((p, i) => {
        switch (p.pattern.kind) {
            case 'hole':
                break
            case 'name':
                const paramDef: ParamDef = { kind: 'param', param: p, index: i }
                module.scopeStack.at(-1)!.definitions.set(defKey(paramDef), paramDef)
                break
            case 'con-pattern':
                todo('add con-pattern to scope')
                break
        }
        checkParam(p, i, ctx)
        return p.type!
    })

    fnDef.type = {
        kind: 'fn-type',
        generics: fnDef.generics.map(g => genericToVirtual(g, ctx)),
        paramTypes,
        returnType: fnDef.returnType ? typeToVirtual(fnDef.returnType, ctx) : unitType
    }

    if (fnDef.returnType) {
        checkType(fnDef.returnType, ctx)
    }

    if (fnDef.block) {
        checkBlock(fnDef.block, ctx)
    } else {
        if (instanceScope(ctx)?.def.kind !== 'trait-def') {
            ctx.warnings.push(semanticError(ctx, fnDef, `fn \`${fnDef.name.value}\` has no body -> must be native`))
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
            param.type = selfType
        } else {
            ctx.errors.push(semanticError(ctx, param, 'parameter type not specified'))
            param.type = unknownType
        }
    } else {
        checkType(param.paramType, ctx)
        if (instScope && param.paramType.kind === 'identifier' && param.paramType.name.value === selfType.name) {
            param.type = selfType
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

    const paramDef: ParamDef = { kind: 'param', param, index }
    module.scopeStack.at(-1)!.definitions.set(defKey(paramDef), paramDef)
}

const checkTraitDef = (traitDef: TraitDef, ctx: Context) => {
    const module = ctx.moduleStack.at(-1)!

    if (instanceScope(ctx)) {
        ctx.errors.push(semanticError(ctx, traitDef, `\`${traitDef.kind}\` within instance scope`))
        return
    }

    module.scopeStack.push({
        kind: 'instance',
        selfType: unknownType,
        def: traitDef,
        definitions: new Map(traitDef.generics.map(g => [defKey(g), g]))
    })
    const selfType = traitDefToVirtualType(traitDef, ctx);
    // must be set afterwards since impl generics cannot be resolved
    (<InstanceScope>module.scopeStack.at(-1)!).selfType = selfType

    checkBlock(traitDef.block, ctx)

    module.scopeStack.pop()
}

const checkImplDef = (implDef: ImplDef, ctx: Context) => {
    if (implDef.checked) return
    implDef.checked = true

    const module = ctx.moduleStack.at(-1)!

    if (instanceScope(ctx)) {
        ctx.errors.push(semanticError(ctx, implDef, 'impl definition within instance scope'))
        return
    }

    module.scopeStack.push({
        kind: 'instance',
        selfType: unknownType,
        def: implDef,
        definitions: new Map(implDef.generics.map(g => [defKey(g), g]))
    })
    const selfType = getImplTargetType(implDef, ctx);
    // must be set afterwards since impl generics cannot be resolved
    (<InstanceScope>module.scopeStack.at(-1)!).selfType = selfType

    if (implDef.forTrait) {
        checkIdentifier(implDef.forTrait, ctx)
    }
    checkIdentifier(implDef.identifier, ctx)

    checkBlock(implDef.block, ctx)

    module.scopeStack.pop()
}

export const checkTypeDef = (typeDef: TypeDef, ctx: Context) => {
    const module = ctx.moduleStack.at(-1)!

    const vid = { names: [...module.identifier.names, typeDef.name.value] }
    module.scopeStack.push({
        kind: 'type',
        def: typeDef,
        vid,
        definitions: new Map(typeDef.generics.map(g => [defKey(g), g]))
    })

    typeDef.variants.forEach(v => checkTypeCon(v, ctx))
    // TODO: check duplicate type cons

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

    // names used in fieldDef, needed to match what typeDef generics are being used
    const names = typeCon.fieldDefs.flatMap(f => typeNames(f.fieldType))
    // unused generics needs to be replaced with `?` because some type cons ignore type def generics,
    // e.g. `Option::None()` should have type of `||: Option<?>`
    const typeArgs = generics.map(g => names.includes(g.name) ? g : unknownType)

    // TODO: introduce a new type kind 'type-con', that, unlike fn type, will also record field names
    // it should be assignable to fn type if argument position matches
    typeCon.type = {
        kind: 'fn-type',
        paramTypes: typeCon.fieldDefs.map(f => typeToVirtual(f.fieldType, ctx)),
        returnType: { kind: 'vid-type', identifier: typeDefScope.vid, typeArgs },
        generics
    }
}

const checkVarDef = (varDef: VarDef, ctx: Context): void => {
    if (varDef.type) return
    const topLevel = ctx.moduleStack.at(-1)!.scopeStack.length === 1

    if (topLevel) {
        if (!varDef.varType) {
            ctx.errors.push(semanticError(ctx, varDef, `top level \`${varDef.kind}\` must have explicit type`))
            return
        }
    }

    if (varDef.varType) {
        checkType(varDef.varType, ctx)
        const instScope = instanceScope(ctx)
        varDef.type = resolveType(
            typeToVirtual(varDef.varType, ctx),
            [instScope ? instanceGenericMap(instScope, ctx) : new Map()],
            varDef,
            ctx
        )
    }

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

/**
 * TODO: provide expected type hint, e.g. varDef type or param type where closure is passed as arg
 */
const checkClosureExpr = (closureExpr: ClosureExpr, ctx: Context): void => {
    if (closureExpr.params.some(p => !p.paramType)) {
        // one approach is to assign every untyped parameter a generic that will be resolved once closure is called
        // with args, e.g. `|a, b| { a + b }` will have type <A, B>|a: A, b: B|: ?
        // no idea what to do with the return type though
        todo("infer closure param types")
    }
    if (!closureExpr.returnType) {
        todo("infer closure return type")
    }

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
 * TODO: call parameterless typeCon, e.g. Option::None()
 * TODO: better error when type-con is called as a function, e.g. Option::Some(4)
 */
const checkCallExpr = (unaryExpr: UnaryExpr, ctx: Context): void => {
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

    const opImplFnVid = operatorImplMap.get(binaryExpr.binaryOp.kind)
    if (!opImplFnVid) throw Error(`operator ${binaryExpr.binaryOp.kind} without impl function`)

    const methodRef = <MethodDef>resolveVid(opImplFnVid, ctx, ['method-def'])?.def
    if (!methodRef) throw Error('impl fn not found')
    if (!methodRef.fn.type) throw Error('untyped impl fn')
    if (methodRef.fn.type.kind !== 'fn-type') throw Error('impl fn type in not fn')

    // TODO: figure out how to resolve generics without their scope
    checkCallArgs(binaryExpr, [binaryExpr.lOperand, binaryExpr.rOperand], (<VirtualFnType>methodRef.fn.type).paramTypes, ctx)
}

const checkListExpr = (listExpr: ListExpr, ctx: Context): void => {
    listExpr.exprs.forEach(e => checkExpr(e, ctx))
    listExpr.type = {
        kind: 'vid-type',
        identifier: vidFromString('std::list::List'),
        // TODO: calculate common type across items
        typeArgs: [listExpr.exprs.at(0)?.type ?? unknownType]
    }
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

const checkIdentifier = (identifier: Identifier, ctx: Context): void => {
    const vid = idToVid(identifier)
    const ref = resolveVid(vid, ctx)
    if (ref) {
        // TODO: refactor
        switch (ref.def.kind) {
            case 'self':
                identifier.type = instanceScope(ctx)!.selfType
                break
            case 'param':
                if (ref.def.param.type === selfType) {
                    const instScope = instanceScope(ctx)
                    identifier.type = resolveType(ref.def.param.type,
                        instScope ? [instanceGenericMap(instScope, ctx)] : [],
                        identifier,
                        ctx
                    )
                } else {
                    identifier.type = ref.def.param.type
                }
                break
            case 'method-def':
                const instScope: InstanceScope = {
                    kind: 'instance',
                    selfType: unknownType,
                    def: ref.def.trait,
                    definitions: new Map(ref.def.trait.generics.map(g => [defKey(g), g]))
                }
                // must be set afterwards since impl generics cannot be resolved
                instScope.selfType = traitDefToVirtualType(ref.def.trait, ctx)

                identifier.type = resolveType(ref.def.fn.type!,
                    [instanceGenericMap(instScope, ctx)],
                    identifier,
                    ctx
                )
                break
            case 'type-con':
                identifier.type = ref.def.typeCon.type
                break
            case 'var-def':
            case 'fn-def':
                identifier.type = ref.def.type
                break
            case 'impl-def':
            case 'trait-def':
            case 'type-def':
            case 'generic':
            case 'module':
                break
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
