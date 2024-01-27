import { AstNode, Module, Param } from '../ast'
import { Identifier } from '../ast/operand'
import { Block, FnDef, ImplDef, ReturnStmt, Statement, TraitDef, VarDef } from '../ast/statement'
import { Generic, Type } from '../ast/type'
import { TypeDef, Variant } from '../ast/type-def'
import {
    BlockScope,
    Context,
    DefinitionMap,
    InstanceScope,
    TypeDefScope,
    defKey,
    fnScope,
    instanceScope
} from '../scope'
import { getInstanceForType, traitDefToVirtualType } from '../scope/trait'
import { idToVid, vidEq, vidToString } from '../scope/util'
import { Definition, NameDef, resolveVid } from '../scope/vid'
import { VirtualType, genericToVirtual, isAssignable, typeToVirtual } from '../typecheck'
import { instanceGenericMap, resolveType } from '../typecheck/generic'
import { holeType, neverType, selfType, unitType, unknownType } from '../typecheck/type'
import { assert, todo } from '../util/todo'
import { notFoundError, semanticError, typeError, unknownTypeError } from './error'
import { checkClosureExpr, checkExpr } from './expr'
import { checkPattern } from './match'
import { typeNames } from './type-def'
import { useExprToVids } from './use-expr'

export interface Checked {
    checked: boolean
}

export interface Typed {
    type: VirtualType
}

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
    if (ctx.moduleStack.find(m => vidEq(m.identifier, module.identifier))) {
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
        case 'variant':
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

export const checkBlock = (block: Block, ctx: Context): boolean => {
    const module = ctx.moduleStack.at(-1)!
    const scope: BlockScope = { kind: 'block', definitions: new Map(), allBranchesReturned: false }
    module.scopeStack.push(scope)

    // TODO: check for unreachable statements after return statement or fns returning `Never`
    // TODO: check less trivial cases when if expr returns in every branch
    for (const s of block.statements) {
        if (scope.allBranchesReturned) {
            ctx.warnings.push(semanticError(ctx, s, `unreachable statement`))
        }

        checkStatement(s, ctx)

        if (
            s.kind === 'return-stmt' ||
            ('type' in s && s.type?.kind === 'vid-type' && vidEq(s.type.identifier, neverType.identifier))
        ) {
            scope.allBranchesReturned = true
        }
    }

    // TODO: combine return statement types
    // TODO: type of a ABR (all branches returned) block should be Never
    const lastStatement = <Partial<Typed> | undefined>block.statements.at(-1)
    block.type = lastStatement?.type ?? unitType
    if (block.type.kind === 'unknown-type') {
        ctx.errors.push(unknownTypeError(block, block.type, ctx))
    }

    module.scopeStack.pop()

    return scope.allBranchesReturned
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
            checkReturnStmt(statement, ctx)
            break
        case 'break-stmt':
            // TODO
            break
    }
}

// TODO: if fn is a part of impl for, make sure signature matches with its trait
const checkFnDef = (fnDef: FnDef, ctx: Context): void => {
    if (fnDef.type) return

    const module = ctx.moduleStack.at(-1)!
    module.scopeStack.push({
        kind: 'fn',
        definitions: new Map(fnDef.generics.map(g => [defKey(g), g])),
        def: fnDef,
        returnStatements: []
    })

    const paramTypes = fnDef.params.map((p, i) => {
        checkParam(p, i, ctx)
        return p.type!
    })

    if (fnDef.returnType) {
        checkType(fnDef.returnType, ctx)
    }

    const returnType = fnDef.returnType ? typeToVirtual(fnDef.returnType, ctx) : unitType
    fnDef.type = {
        kind: 'fn-type',
        generics: fnDef.generics.map(g => genericToVirtual(g, ctx)),
        paramTypes,
        returnType
    }

    const instScope = instanceScope(ctx)
    const genericMaps = instScope ? [instanceGenericMap(instScope, ctx)] : []
    const returnTypeResolved = resolveType(returnType, genericMaps, fnDef.returnType ?? fnDef, ctx)

    if (fnDef.block) {
        checkBlock(fnDef.block, ctx)
        const blockType = fnDef.block.type!
        if (!isAssignable(blockType, returnTypeResolved, ctx)) {
            ctx.errors.push(typeError(fnDef.block, blockType, returnTypeResolved, ctx))
        }
        fnScope(ctx)!.returnStatements.forEach(rs => {
            if (!isAssignable(rs.type!, returnTypeResolved, ctx)) {
                ctx.errors.push(typeError(rs, rs.type!, returnTypeResolved, ctx))
            }
        })
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
            ctx.errors.push(
                semanticError(ctx, param.pattern, `\`${param.pattern.kind}\` can only be used in match expressions`)
            )
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
    const selfType = traitDefToVirtualType(traitDef, ctx)
    // must be set afterwards since impl generics cannot be resolved
    ;(<InstanceScope>module.scopeStack.at(-1)!).selfType = selfType

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
    const selfType = getInstanceForType(implDef, ctx)
    // must be set afterwards since impl generics cannot be resolved
    ;(<InstanceScope>module.scopeStack.at(-1)!).selfType = selfType

    checkType(implDef.identifier, ctx)
    if (implDef.forTrait) {
        checkType(implDef.forTrait, ctx)

        // presence of for trait means that implDef.identifier is an implemented trait
        const vid = idToVid(implDef.identifier)
        const ref = resolveVid(vid, ctx)
        if (ref) {
            if (ref.def.kind === 'trait-def') {
                const requiredImplMethods = ref.def.block.statements
                    .filter(s => s.kind === 'fn-def')
                    .map(s => <FnDef>s)
                    .filter(f => !f.block)
                const implMethods = implDef.block.statements.filter(s => s.kind === 'fn-def').map(s => <FnDef>s)
                for (let m of requiredImplMethods) {
                    const mName = m.name.value
                    if (!implMethods.find(im => im.name.value === mName)) {
                        ctx.errors.push(
                            semanticError(
                                ctx,
                                implDef.forTrait,
                                `missing method implementation \`${vidToString(ref.vid)}::${mName}\``
                            )
                        )
                    }
                }
            } else {
                ctx.errors.push(semanticError(ctx, implDef.forTrait, `expected \`trait-def\`, got \`${ref.def.kind}\``))
            }
        } else {
            ctx.errors.push(notFoundError(ctx, implDef.forTrait, vidToString(vid)))
        }

        // TODO: check bounded traits are implemented by type,
        // e.g. `impl Ord for Foo` equires `impl Eq for Foo` since `trait Ord<Self: Eq>`
    }

    checkBlock(implDef.block, ctx)

    module.scopeStack.pop()
}

export const checkTypeDef = (typeDef: TypeDef, ctx: Context) => {
    if (typeDef.checked) return
    typeDef.checked = true

    const module = ctx.moduleStack.at(-1)!

    const vid = { names: [...module.identifier.names, typeDef.name.value] }
    module.scopeStack.push({
        kind: 'type',
        def: typeDef,
        vid,
        definitions: new Map(typeDef.generics.map(g => [defKey(g), g]))
    })

    typeDef.variants.forEach(v => checkVariant(v, ctx))
    // TODO: check duplicate variants

    module.scopeStack.pop()
}

const checkVariant = (variant: Variant, ctx: Context) => {
    if (variant.type) return

    const module = ctx.moduleStack.at(-1)!
    const typeDefScope = <TypeDefScope>module.scopeStack.at(-1)!
    variant.fieldDefs.forEach(fieldDef => {
        checkType(fieldDef.fieldType, ctx)
        fieldDef.type = typeToVirtual(fieldDef.fieldType, ctx)
        // TODO: check duplicate field defs
    })

    const generics = [...typeDefScope.definitions.values()].map(d => <Generic>d).map(g => genericToVirtual(g, ctx))

    // names used in fieldDef, needed to match what typeDef generics are being used
    const names = variant.fieldDefs.flatMap(f => typeNames(f.fieldType))
    // unused generics needs to be replaced with `_` because some variants ignore type def generics,
    // e.g. `Option::None()` should have type of `||: Option<_>`
    const typeArgs = generics.map(g => (names.includes(g.name) ? g : holeType))

    // TODO: introduce a new type kind 'variant', that, unlike fn type, will also record field names
    // it should be assignable to fn type if argument position matches
    variant.type = {
        kind: 'fn-type',
        paramTypes: variant.fieldDefs.map(f => typeToVirtual(f.fieldType, ctx)),
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
            instScope ? [instanceGenericMap(instScope, ctx)] : [],
            varDef,
            ctx
        )
    }

    checkExpr(varDef.expr, ctx)

    if (varType) {
        const exprType = varDef.expr.type!
        if (!isAssignable(exprType, varType, ctx)) {
            ctx.errors.push(typeError(varDef, exprType, varType, ctx))
        }
    } else {
        if (varDef.expr.type!.kind === 'unknown-type') {
            ctx.errors.push(unknownTypeError(varDef.expr, varDef.expr.type!, ctx))
            varType = unknownType
        } else {
            varType = varDef.expr.type
        }
    }

    checkPattern(varDef.pattern, varType!, ctx)
}

export const checkReturnStmt = (returnStmt: ReturnStmt, ctx: Context) => {
    const scope = fnScope(ctx)

    if (!scope) {
        ctx.errors.push(semanticError(ctx, returnStmt, `\`${returnStmt.kind}\` outside of function scope`))
    }

    checkExpr(returnStmt.returnExpr, ctx)
    returnStmt.type = returnStmt.returnExpr.type

    scope?.returnStatements.push(returnStmt)
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

                identifier.type = resolveType(ref.def.fn.type!, [instanceGenericMap(instScope, ctx)], identifier, ctx)
                break
            case 'variant':
                identifier.type = ref.def.variant.type
                break
            case 'fn-def':
                identifier.type = ref.def.type
                break
            case 'impl-def':
            case 'trait-def':
            case 'type-def':
            case 'generic':
            case 'module':
                identifier.type = unknownType
                break
        }

        // TODO: check that type args match type params
        identifier.typeArgs.forEach(typeArg => checkType(typeArg, ctx))
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
            const k = ref.def.kind
            if (!['type-def', 'trait-def', 'generic', 'self'].includes(k)) {
                ctx.errors.push(semanticError(ctx, type.name, `expected type, got \`${ref.def.kind}\``))
                return
            }
            if (type.typeArgs.length > 0 && (k === 'generic' || k === 'self')) {
                ctx.errors.push(semanticError(ctx, type.name, `\`${ref.def.kind}\` does not accept type arguments`))
                return
            }
            if (k === 'type-def' || k === 'trait-def') {
                const typeParams = ref.def.generics.filter(g => g.name.value !== selfType.name)
                if (type.typeArgs.length !== typeParams.length) {
                    ctx.errors.push(
                        semanticError(
                            ctx,
                            type,
                            `expected ${typeParams.length} type arguments, got ${type.typeArgs.length}`
                        )
                    )
                    return
                }
                type.typeArgs.forEach(tp => {
                    checkType(tp, ctx)
                })
            }
            return
        case 'type-bounds':
            type.bounds.forEach(b => checkType(b, ctx))
            return
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
        if (arg.type?.kind === 'malleable-type' && paramType.kind === 'fn-type') {
            checkClosureExpr(arg.type.closure, ctx, node, paramType)
            arg.type = arg.type.closure.type
        }
        const argType = arg.type || unknownType

        if (!isAssignable(argType, paramType, ctx)) {
            ctx.errors.push(typeError(arg, argType, paramType, ctx))
        }
    }
}
