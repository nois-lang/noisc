import { AstNode, Module, Param } from '../ast'
import { Identifier } from '../ast/operand'
import { Block, FnDef, ImplDef, Statement, TraitDef, VarDef } from '../ast/statement'
import { Generic, Type } from '../ast/type'
import { TypeCon, TypeDef } from '../ast/type-def'
import { Context, DefinitionMap, InstanceScope, TypeDefScope, defKey, instanceScope } from '../scope'
import { getImplTargetType, traitDefToVirtualType } from '../scope/trait'
import { idToVid, vidToString } from '../scope/util'
import { Definition, NameDef, resolveVid } from '../scope/vid'
import {
    Typed,
    VirtualType,
    genericToVirtual,
    isAssignable,
    typeToVirtual
} from '../typecheck'
import { instanceGenericMap, resolveType } from '../typecheck/generic'
import { selfType, unitType, unknownType } from '../typecheck/type'
import { assert, todo } from '../util/todo'
import { notFoundError, semanticError, typeError } from './error'
import { checkExpr } from './expr'
import { checkPattern } from './match'
import { typeNames } from './type-def'
import { useExprToVids } from './use-expr'

export const prepareModule = (module: Module): void => {
    const defMap: DefinitionMap = new Map()
    module.block.statements.map(s => {
        switch (s.kind) {
            case 'fn-def':
            case 'trait-def':
            case 'impl-def':
            case 'type-def':
                defMap.set(defKey(s), s)
                break
            case 'var-def':
                switch (s.pattern.expr.kind) {
                    case 'name':
                        const nameDef: NameDef = { kind: 'name-def', name: s.pattern.expr, parent: s }
                        defMap.set(defKey(nameDef), nameDef)
                        break
                    case 'hole':
                        break
                    default:
                        todo(`top level \`${s.pattern.kind}\``)
                        break
                }
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
        case 'name-def':
            if (definition.parent) {
                checkStatement(definition.parent, ctx)
            }
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

export const checkBlock = (block: Block, ctx: Context): void => {
    const module = ctx.moduleStack.at(-1)!
    module.scopeStack.push({ kind: 'block', definitions: new Map() })

    block.statements.forEach(s => checkStatement(s, ctx))

    // TODO: find return statements and combine type
    const lastStatement = <Partial<Typed> | undefined>block.statements.at(-1)
    block.type = lastStatement?.type ?? unknownType

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

const checkFnDef = (fnDef: FnDef, ctx: Context): void => {
    if (fnDef.type) return

    const module = ctx.moduleStack.at(-1)!
    module.scopeStack.push({ kind: 'fn', definitions: new Map(fnDef.generics.map(g => [defKey(g), g])) })

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

export const checkParam = (param: Param, index: number, ctx: Context): void => {
    const instScope = instanceScope(ctx)

    if (!param.paramType) {
        if (index === 0 && instScope && param.pattern.expr.kind === 'name' && param.pattern.expr.value === 'self') {
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

    switch (param.pattern.expr.kind) {
        case 'operand-expr':
        case 'unary-expr':
        case 'binary-expr':
            ctx.errors.push(semanticError(ctx, param.pattern, `\`${param.pattern.kind}\` can only be used in match expressions`))
            break
        default:
            checkPattern(param.pattern, param.type, ctx)
            break
    }
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
    if (varDef.checked) return
    varDef.checked = true

    const topLevel = ctx.moduleStack.at(-1)!.scopeStack.length === 1

    if (topLevel && !varDef.varType) {
        ctx.errors.push(semanticError(ctx, varDef, `top level \`${varDef.kind}\` must have explicit type`))
        return
    }

    let varType: VirtualType | undefined

    if (varDef.varType) {
        checkType(varDef.varType, ctx)
        const instScope = instanceScope(ctx)
        varType = resolveType(
            typeToVirtual(varDef.varType, ctx),
            [instScope ? instanceGenericMap(instScope, ctx) : new Map()],
            varDef,
            ctx
        )
    }

    checkExpr(varDef.expr, ctx)

    if (varType) {
        const exprType = varDef.expr.type ?? unknownType
        if (!isAssignable(exprType, varType ?? unknownType, ctx)) {
            ctx.errors.push(typeError(varDef, exprType, varType, ctx))
        }
    } else {
        varType = varDef.expr.type
    }

    checkPattern(varDef.pattern, varType!, ctx)
}

export const checkIdentifier = (identifier: Identifier, ctx: Context): void => {
    const vid = idToVid(identifier)
    const ref = resolveVid(vid, ctx)
    if (ref) {
        // TODO: refactor
        switch (ref.def.kind) {
            case 'self':
                identifier.type = instanceScope(ctx)!.selfType
                break
            case 'name-def':
                const name = ref.def.name
                if (name.type === selfType) {
                    const instScope = instanceScope(ctx)
                    identifier.type = resolveType(
                        name.type,
                        instScope ? [instanceGenericMap(instScope, ctx)] : [],
                        identifier,
                        ctx
                    )
                } else {
                    identifier.type = name.type
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

export const checkType = (type: Type, ctx: Context) => {
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

