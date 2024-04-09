import { AstNode, Module, Param } from '../ast'
import { Identifier, Name, Operand } from '../ast/operand'
import { Block, BreakStmt, FnDef, ImplDef, ReturnStmt, Statement, TraitDef, VarDef } from '../ast/statement'
import { Generic, Type } from '../ast/type'
import { TypeDef, Variant } from '../ast/type-def'
import {
    BlockScope,
    Context,
    DefinitionMap,
    FnDefScope,
    InstanceScope,
    TypeDefScope,
    addError,
    addWarning,
    defKey,
    fnDefScope,
    instanceScope,
    unwindScope
} from '../scope'
import { InstanceRelation, findSuperRelChains } from '../scope/trait'
import { idToVid, vidEq, vidToString } from '../scope/util'
import { Definition, MethodDef, NameDef, VirtualIdentifierMatch, resolveVid, typeKinds } from '../scope/vid'
import { VirtualFnType, VirtualType, genericToVirtual, isAssignable, typeEq, typeToVirtual } from '../typecheck'
import { instanceGenericMap, makeFnGenericMap, makeGenericMapOverStructure, resolveType } from '../typecheck/generic'
import { holeType, neverType, selfType, unitType, unknownType } from '../typecheck/type'
import { assert, todo, unreachable } from '../util/todo'
import {
    argCountMismatchError,
    circularModuleError,
    duplicateError,
    expectedTraitError,
    methodNotDefinedError,
    missingMethodImplsError,
    missingVarInitError,
    noBodyFnError,
    notFoundError,
    notInFnScopeError,
    notInLoopScopeError,
    privateAccessError,
    selfImportError,
    topLevelVarNotDefinedError,
    topLevelVarUntypedError,
    typeArgCountMismatchError,
    typeError,
    unexpectedInInstanceScopeError,
    unexpectedPatternKindError,
    unexpectedTopLevelStatementError,
    unknownTypeError,
    unnecessaryPubMethodError,
    unreachableStatementError,
    unspecifiedParamTypeError,
    vidResolveToModuleError
} from './error'
import { checkExpr, checkQualifiedMethodCall, checkResolvedClosureExpr } from './expr'
import { checkPattern } from './match'
import { typeNames } from './type-def'
import { Upcast, UpcastFn, makeUpcast, upcast } from './upcast'
import { VirtualUseExpr, useExprToVids } from './use-expr'

export interface Checked {
    checked: boolean
}

export interface TopLevelChecked {
    topLevelChecked: boolean
}

export interface Typed {
    type: VirtualType
}

export interface Static {
    impl: InstanceRelation
}

export interface Virtual {
    upcasts: Upcast[]
    upcastFn: UpcastFn
}

export const prepareModule = (module: Module): void => {
    const defMap: DefinitionMap = new Map()
    module.block.statements.map(s => {
        switch (s.kind) {
            case 'fn-def':
            case 'trait-def':
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
            case 'impl-def':
            case 'operand-expr':
            case 'unary-expr':
            case 'binary-expr':
            case 'return-stmt':
                break
        }
    })
    module.topScope = { kind: 'module', definitions: defMap }

    module.references = module.useExprs.filter(e => !e.pub).flatMap(e => useExprToVids(e))
    module.reExports = module.useExprs.filter(e => e.pub).flatMap(e => useExprToVids(e))
}

export const checkModule = (module: Module, ctx: Context): void => {
    assert(!!module.topScope, 'module top scope is not set')
    if (ctx.moduleStack.find(m => vidEq(m.identifier, module.identifier))) {
        addError(ctx, circularModuleError(ctx, module))
        return
    }
    ctx.moduleStack.push(module)

    const resolvedRefs = []
    for (const useExpr of module.references!) {
        const ref = checkUseExpr(useExpr, ctx)
        if (!ref) continue
        const name = <Name>useExpr.useExpr.expr
        if (resolvedRefs.filter(e => vidEq(e.vid, ref.vid)).length > 0) {
            // TODO: reference first occurrence
            addWarning(ctx, duplicateError(ctx, name, name.value, 'import'))
            continue
        }
        if (ref.module === module) {
            addWarning(ctx, selfImportError(ctx, name))
            continue
        }
        resolvedRefs.push({ vid: ref.vid, useExpr: useExpr.useExpr })
    }
    module.references = resolvedRefs

    for (const reExport of module.reExports!) {
        checkUseExpr(reExport, ctx)
    }

    checkBlock(module.block, ctx)
    ctx.moduleStack.pop()
}

export const checkUseExpr = (useExpr: VirtualUseExpr, ctx: Context): VirtualIdentifierMatch<Definition> | undefined => {
    const pkgName = useExpr.vid.names[0]
    if (!ctx.packages.some(pkg => pkg.name === pkgName)) {
        addError(ctx, notFoundError(ctx, useExpr.useExpr.scope[0], pkgName, 'package'))
        return undefined
    }
    const name = <Name>useExpr.useExpr.expr
    const ref = resolveVid(useExpr.vid, ctx)
    if (!ref) {
        addError(ctx, notFoundError(ctx, name, vidToString(useExpr.vid)))
        return undefined
    }
    return ref
}

/*
 * Can be called outside of scope, module's own scope stack is preserved
 */
export const checkTopLevelDefinition = (module: Module, definition: Definition, ctx: Context): void => {
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
            const instanceDef = definition.rel.instanceDef
            if (instanceDef.kind === 'impl-def') {
                if (!instanceDef.checked) {
                    checkImplDef(instanceDef, ctx)
                    instanceDef.checked = true
                }
            } else {
                checkTraitDef(instanceDef, ctx)
            }
            break
        case 'impl-def':
            if (!definition.checked) {
                checkImplDef(definition, ctx)
                definition.checked = true
            }
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
    const scope: BlockScope = { kind: 'block', definitions: new Map(), isLoop: false, allBranchesReturned: false }
    module.scopeStack.push(scope)

    // TODO: check for unreachable statements after return statement or fns returning `Never`
    for (const s of block.statements) {
        if (scope.allBranchesReturned) {
            addWarning(ctx, unreachableStatementError(ctx, s))
        }

        checkStatement(s, ctx)

        if (
            s.kind === 'return-stmt' ||
            s.kind === 'break-stmt' ||
            ('type' in s && s.type?.kind === 'vid-type' && vidEq(s.type.identifier, neverType.identifier))
        ) {
            scope.allBranchesReturned = true
        }
    }

    if (scope.allBranchesReturned) {
        block.type = neverType
    } else {
        const lastStatement = block.statements.at(-1)
        block.type = lastStatement && 'type' in lastStatement ? lastStatement.type : unitType
        if (
            module.scopeStack.at(-2)?.kind === 'fn' &&
            lastStatement &&
            (lastStatement.kind === 'operand-expr' ||
                lastStatement.kind === 'unary-expr' ||
                lastStatement.kind === 'binary-expr')
        ) {
            fnDefScope(ctx)?.returns.push(lastStatement)
        }
    }

    module.scopeStack.pop()

    return scope.allBranchesReturned
}

const checkStatement = (statement: Statement, ctx: Context): void => {
    const module = ctx.moduleStack.at(-1)!
    const scope = module.scopeStack.at(-1)!
    const topLevel = module.scopeStack.length === 1

    if (topLevel && !['var-def', 'fn-def', 'trait-def', 'impl-def', 'type-def'].includes(statement.kind)) {
        addError(ctx, unexpectedTopLevelStatementError(ctx, statement))
        return
    }
    if (['impl-def', 'trait-def'].includes(scope.kind) && statement.kind !== 'fn-def') {
        addError(ctx, unexpectedInInstanceScopeError(ctx, statement))
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
            // variants are accessible from the module scope
            statement.variants.forEach(v => {
                pushDefToStack({ kind: 'variant', variant: v, typeDef: statement })
            })
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
            checkBreakStmt(statement, ctx)
            break
    }
}

const checkFnDef = (fnDef: FnDef, ctx: Context): void => {
    if (fnDef.checked) return
    if (ctx.check) {
        fnDef.checked = true
    }
    const module = ctx.moduleStack.at(-1)!
    const fnScope: FnDefScope = {
        kind: 'fn',
        definitions: new Map(fnDef.generics.map(g => [defKey(g), g])),
        def: fnDef,
        returns: []
    }
    module.scopeStack.push(fnScope)

    const paramTypes = fnDef.params.map((p, i) => {
        checkParam(p, i, ctx)
        return p.type!
    })
    const firstParam = paramTypes.at(0)
    fnDef.static = !(firstParam?.kind === 'generic' && firstParam.name === selfType.name)

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
    const genericMaps = instScope ? [instanceGenericMap(instScope.def, ctx)] : []
    const returnTypeResolved = resolveType(returnType, genericMaps, ctx)

    if (ctx.check && !module.compiled) {
        if (fnDef.block) {
            checkBlock(fnDef.block, ctx)
            fnScope.returns.forEach(rs => {
                if (!isAssignable(rs.type!, returnTypeResolved, ctx)) {
                    addError(ctx, typeError(ctx, rs, rs.type!, returnTypeResolved))
                }
                upcast(rs, rs.type!, returnTypeResolved, ctx)
            })
            if (!isAssignable(fnDef.block.type!, returnTypeResolved, ctx)) {
                addError(ctx, typeError(ctx, fnDef.returnType ?? fnDef.block, fnDef.block.type!, returnTypeResolved))
            }
        } else {
            if (!instScope) {
                addWarning(ctx, noBodyFnError(ctx, fnDef))
            } else {
                if (instScope?.rel?.instanceDef.kind !== 'trait-def') {
                    addError(ctx, noBodyFnError(ctx, fnDef))
                }
            }
        }
        if (instScope?.rel?.instanceDef.kind === 'trait-def' && fnDef.pub) {
            addWarning(ctx, unnecessaryPubMethodError(ctx, fnDef))
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
            addError(ctx, unspecifiedParamTypeError(ctx, param))
            param.type = unknownType
        }
    } else {
        checkType(param.paramType, ctx)
        if (
            instScope &&
            param.paramType.kind === 'identifier' &&
            param.paramType.names.at(-1)!.value === selfType.name
        ) {
            param.type = selfType
        } else {
            param.type = typeToVirtual(param.paramType, ctx)
        }
    }

    switch (param.pattern.expr.kind) {
        case 'operand-expr':
        case 'unary-expr':
        case 'binary-expr':
            addError(ctx, unexpectedPatternKindError(ctx, param))
            break
        default:
            checkPattern(param.pattern, param.type, ctx, false)
            break
    }
}

const checkTraitDef = (traitDef: TraitDef, ctx: Context) => {
    const rel = ctx.impls.find(i => i.instanceDef === traitDef)
    if (!rel) return

    const module = ctx.moduleStack.at(-1)!

    if (instanceScope(ctx)) {
        addError(ctx, unexpectedInInstanceScopeError(ctx, traitDef))
        return
    }

    const scope: InstanceScope = {
        kind: 'instance',
        def: rel.instanceDef,
        rel,
        definitions: new Map(traitDef.generics.map(g => [defKey(g), g]))
    }
    module.scopeStack.push(scope)

    checkBlock(traitDef.block, ctx)
    // TODO: make sure method signature matches with its trait

    module.scopeStack.pop()
}

const checkImplDef = (implDef: ImplDef, ctx: Context) => {
    if (!implDef.rel) {
        const rel = ctx.impls.find(i => i.instanceDef === implDef)
        assert(!!rel)
        implDef.rel = rel!
    }

    const module = ctx.moduleStack.at(-1)!

    if (instanceScope(ctx)) {
        addError(ctx, unexpectedInInstanceScopeError(ctx, implDef))
        return
    }

    const scope: InstanceScope = {
        kind: 'instance',
        def: implDef,
        definitions: new Map(implDef.generics.map(g => [defKey(g), g]))
    }
    module.scopeStack.push(scope)

    checkBlock(implDef.block, ctx)

    checkType(implDef.identifier, ctx)

    if (implDef.forTrait) {
        checkType(implDef.forTrait, ctx)

        const vid = idToVid(implDef.identifier)
        const ref = resolveVid(vid, ctx, ['type-def', 'trait-def'])
        if (ref) {
            if (module.compiled) {
            } else if (ref.def.kind === 'trait-def') {
                const traitRels = [
                    ctx.impls.find(rel => rel.instanceDef === ref.def)!,
                    ...findSuperRelChains(ref.vid, ctx).flatMap(chain => chain)
                ]
                const traitMethods: MethodDef[] = traitRels.flatMap(t => {
                    const methods = <FnDef[]>t.instanceDef.block.statements.filter(s => s.kind === 'fn-def')
                    return methods.map(m => ({ kind: 'method-def', rel: t, fn: m }))
                })
                const requiredImplMethods = traitMethods.filter(f => !f.fn.block)
                const implMethods = implDef.block.statements.filter(s => s.kind === 'fn-def').map(s => <FnDef>s)
                const missingImpls = requiredImplMethods.filter(
                    m => !implMethods.find(im => im.name.value === m.fn.name.value)
                )
                if (missingImpls.length > 0) {
                    addError(ctx, missingMethodImplsError(ctx, implDef, missingImpls))
                }
                for (const m of implMethods) {
                    const mName = m.name.value
                    const mVid = `${vidToString(ref.vid)}::${mName}`
                    const traitMethod = traitMethods.find(im => im.fn.name.value === mName)
                    if (!traitMethod) {
                        addError(ctx, methodNotDefinedError(ctx, m, mVid))
                        continue
                    }
                    checkTopLevelDefinition(traitMethod.rel.module, traitMethod, ctx)

                    const genericMaps = [
                        makeFnGenericMap(<VirtualFnType>traitMethod.fn.type!, (<VirtualFnType>m.type!).paramTypes),
                        makeGenericMapOverStructure(implDef.rel.implType, traitMethod.rel.implType)
                    ]
                    const mResolvedType = resolveType(traitMethod.fn.type!, genericMaps, ctx)
                    if (!(isAssignable(m.type!, mResolvedType, ctx) && typeEq(m.type!, mResolvedType))) {
                        addError(ctx, typeError(ctx, m.name, m.type!, mResolvedType))
                    }
                }
                implDef.superMethods = traitMethods.filter(
                    m => m.fn.block && !implMethods.find(im => im.name.value === m.fn.name.value)
                )
                implDef.superMethods.forEach(m => checkTopLevelDefinition(m.rel.module, m, ctx))
                for (const m of implDef.superMethods) {
                    m.paramUpcasts = m.fn.params.map(p => {
                        const genericMaps = [makeGenericMapOverStructure(implDef.rel!.forType, p.type!)]
                        const resolvedType = resolveType(p.type!, genericMaps, ctx)
                        return makeUpcast(resolvedType, m.rel.forType, ctx)
                    })
                }
                module.relImports.push(...implDef.superMethods.map(i => i.rel))
            } else {
                addError(ctx, expectedTraitError(ctx, implDef.forTrait))
            }
        } else {
            addError(ctx, notFoundError(ctx, implDef.forTrait, vidToString(vid)))
        }

        // TODO: check that bounded traits are implemented by type,
        // e.g. `impl Ord for Foo` requires `impl Eq for Foo` since `trait Ord<Self: Eq>`
    }

    module.scopeStack.pop()
}

export const checkTypeDef = (typeDef: TypeDef, ctx: Context) => {
    if (typeDef.checked) return
    typeDef.checked = true

    const module = ctx.moduleStack.at(-1)!

    const vid = { names: [...module.identifier.names, typeDef.name.value] }
    const definitions = new Map(typeDef.generics.map(g => [defKey(g), g]))
    module.scopeStack.push({ kind: 'type', def: typeDef, vid, definitions })

    typeDef.variants.forEach((v, i) => {
        checkVariant(v, ctx)

        if (typeDef.variants.slice(0, i).some(ov => ov.name.value === v.name.value)) {
            addError(ctx, duplicateError(ctx, v.name, v.name.value, 'variant'))
        }
    })

    module.scopeStack.pop()
}

const checkVariant = (variant: Variant, ctx: Context) => {
    if (variant.type) return

    const module = ctx.moduleStack.at(-1)!
    const typeDefScope = <TypeDefScope>module.scopeStack.at(-1)!
    variant.fieldDefs.forEach((fieldDef, i) => {
        checkType(fieldDef.fieldType, ctx)
        fieldDef.type = typeToVirtual(fieldDef.fieldType, ctx)

        if (variant.fieldDefs.slice(0, i).some(f => f.name.value === fieldDef.name.value)) {
            addError(ctx, duplicateError(ctx, fieldDef.name, fieldDef.name.value, 'field'))
        }
    })

    const generics = [...typeDefScope.definitions.values()].map(d => <Generic>d).map(g => genericToVirtual(g, ctx))

    // names used in fieldDef, needed to match what typeDef generics are being used
    const names = variant.fieldDefs.flatMap(f => typeNames(f.fieldType))
    // unused generics needs to be replaced with `_` because some variants ignore type def generics,
    // e.g. `Option::None()` should have type of `||: Option<_>`
    const typeArgs = generics.map(g => (names.includes(g.name) ? g : holeType))

    variant.type = {
        kind: 'fn-type',
        paramTypes: variant.fieldDefs.map(f => typeToVirtual(f.fieldType, ctx)),
        returnType: { kind: 'vid-type', identifier: typeDefScope.vid, typeArgs },
        generics
    }
}

/**
 * TODO: resolve hole types in varDef.varType
 */
const checkVarDef = (varDef: VarDef, ctx: Context): void => {
    if (varDef.checked) return
    varDef.checked = true

    const module = ctx.moduleStack.at(-1)!
    const topLevel = module.scopeStack.length === 1

    if (topLevel && !varDef.varType) {
        addError(ctx, topLevelVarUntypedError(ctx, varDef))
        return
    }
    if (topLevel && !module.compiled && !varDef.expr) {
        addError(ctx, topLevelVarNotDefinedError(ctx, varDef))
        return
    }

    let varType: VirtualType | undefined

    if (varDef.varType) {
        checkType(varDef.varType, ctx)
        const instScope = instanceScope(ctx)
        varType = resolveType(
            typeToVirtual(varDef.varType, ctx),
            instScope ? [instanceGenericMap(instScope.def, ctx)] : [],
            ctx
        )
    }

    if (varDef.expr) {
        checkExpr(varDef.expr, ctx)

        if (varType) {
            const exprType = varDef.expr.type!
            if (!isAssignable(exprType, varType, ctx)) {
                addError(ctx, typeError(ctx, varDef, exprType, varType))
            }
        } else {
            if (varDef.expr.type!.kind === 'unknown-type') {
                addError(ctx, unknownTypeError(ctx, varDef.expr, varDef.expr.type!))
                varType = unknownType
            } else {
                varType = varDef.expr.type
            }
        }

        checkPattern(varDef.pattern, varType!, ctx, false)
    } else {
        if (!module.compiled) {
            addError(ctx, missingVarInitError(ctx, varDef))
        }
    }
}

export const checkReturnStmt = (returnStmt: ReturnStmt, ctx: Context) => {
    const scope = fnDefScope(ctx)

    if (!scope) {
        addError(ctx, notInFnScopeError(ctx, returnStmt))
    }

    checkExpr(returnStmt.returnExpr, ctx)
    returnStmt.type = returnStmt.returnExpr.type

    scope?.returns.push(returnStmt.returnExpr)
}

export const checkBreakStmt = (breakStmt: BreakStmt, ctx: Context) => {
    const scopes = unwindScope(ctx)
    const loopScopeExists = scopes.some(s => s.kind === 'block' && s.isLoop)
    if (loopScopeExists) {
        for (const scope of scopes) {
            if (scope.kind === 'fn') {
                addError(ctx, notInLoopScopeError(ctx, breakStmt))
                return
            }
            if (scope.kind === 'block' && scope.isLoop) {
                return
            }
        }
    } else {
        addError(ctx, notInLoopScopeError(ctx, breakStmt))
    }
}

export const checkIdentifier = (identifier: Identifier, ctx: Context): void => {
    const vid = idToVid(identifier)
    // TODO: if absolute import, check that package is explicitly imported
    const ref = resolveVid(vid, ctx)
    if (ref) {
        identifier.ref = ref
        switch (ref.def.kind) {
            case 'self':
                identifier.type = instanceScope(ctx)?.rel?.forType ?? unknownType
                break
            case 'name-def':
                const name = ref.def.name
                if (
                    ref.def.parent &&
                    ref.def.parent.kind === 'var-def' &&
                    !ref.def.parent.pub &&
                    ref.module !== ctx.moduleStack.at(-1)!
                ) {
                    addError(ctx, privateAccessError(ctx, identifier, 'variable', ref.def.name.value))
                }
                if (name.type === selfType) {
                    const instScope = instanceScope(ctx)
                    identifier.type = resolveType(
                        name.type,
                        instScope ? [instanceGenericMap(instScope.def, ctx)] : [],
                        ctx
                    )
                } else {
                    identifier.type = name.type
                }
                break
            case 'method-def':
                if (
                    !ref.def.fn.pub &&
                    ref.def.rel.instanceDef.kind === 'impl-def' &&
                    ref.module !== ctx.moduleStack.at(-1)!
                ) {
                    addError(ctx, privateAccessError(ctx, identifier, 'method', ref.def.fn.name.value))
                }

                identifier.type = { kind: 'malleable-type', operand: identifier }
                break
            case 'variant':
                identifier.type = ref.def.variant.type
                break
            case 'fn-def':
                if (!ref.def.pub && ref.module !== ctx.moduleStack.at(-1)!) {
                    addError(ctx, privateAccessError(ctx, identifier, 'function', ref.def.name.value))
                }
                identifier.type = ref.def.type
                break
            case 'module':
                addError(ctx, vidResolveToModuleError(ctx, identifier, vidToString(vid)))
                identifier.type = unknownType
                break
            default:
                identifier.type = unknownType
                break
        }

        // TODO: check that type args match type params
        identifier.typeArgs.forEach(typeArg => checkType(typeArg, ctx))
    } else {
        addError(ctx, notFoundError(ctx, identifier, vidToString(vid)))
        identifier.type = unknownType
    }
}

export const checkType = (type: Type, ctx: Context) => {
    if (type.checked) return
    type.checked = true

    switch (type.kind) {
        case 'identifier':
            const vid = idToVid(type)
            const ref = resolveVid(vid, ctx, typeKinds)
            if (!ref) {
                addError(ctx, notFoundError(ctx, type, vidToString(vid), 'type'))
                return
            }
            const k = ref.def.kind
            if (type.typeArgs.length > 0 && (k === 'generic' || k === 'self')) {
                addError(ctx, typeArgCountMismatchError(ctx, type, 0, type.typeArgs.length))
                return
            }
            if (k === 'type-def' || k === 'trait-def') {
                type.typeArgs.forEach(tp => checkType(tp, ctx))
                const typeParams = ref.def.generics.filter(g => g.name.value !== selfType.name)
                if (type.typeArgs.length !== typeParams.length) {
                    addError(ctx, typeArgCountMismatchError(ctx, type, typeParams.length, type.typeArgs.length))
                    return
                }
            }
            return
        case 'type-bounds':
            type.bounds.forEach(b => checkType(b, ctx))
            return
        case 'fn-type':
            // TODO: scope for generics
            type.paramTypes.forEach(p => checkType(p, ctx))
            checkType(type.returnType, ctx)
            return
    }
}

export const resolveMallebleType = (arg: Operand, paramType: VirtualType, ctx: Context): void => {
    if (arg.type!.kind === 'malleable-type' && paramType.kind === 'fn-type') {
        switch (arg.type!.operand.kind) {
            case 'closure-expr':
                const closure = arg.type!.operand
                arg.type! = checkResolvedClosureExpr(closure, ctx, arg, paramType)
                break
            case 'identifier':
                // TODO: properly
                const ref = arg.type!.operand.ref
                if (ref?.def.kind !== 'method-def') return unreachable()
                arg.type = checkQualifiedMethodCall(
                    arg.type!.operand,
                    <VirtualIdentifierMatch<MethodDef>>ref,
                    ctx,
                    paramType
                )
                break
            default:
                unreachable()
        }
    }
}

export const checkCallArgs = (node: AstNode<any>, args: Operand[], paramTypes: VirtualType[], ctx: Context): void => {
    if (args.length !== paramTypes.length) {
        addError(ctx, argCountMismatchError(ctx, node, paramTypes.length, args.length))
        return
    }

    for (let i = 0; i < paramTypes.length; i++) {
        const paramType = paramTypes[i]
        const arg = args[i]
        resolveMallebleType(arg, paramType, ctx)
        if (!isAssignable(arg.type!, paramType, ctx)) {
            addError(ctx, typeError(ctx, arg, arg.type!, paramType))
        }

        upcast(arg, arg.type!, paramType, ctx)
    }
}
