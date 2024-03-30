import { Arg, AstNode, Module, Param } from '../ast'
import { Expr } from '../ast/expr'
import { MatchClause, MatchExpr, PatternExpr } from '../ast/match'
import { CallOp } from '../ast/op'
import { Identifier, Name, Operand } from '../ast/operand'
import { FnDef, ImplDef, Statement, VarDef } from '../ast/statement'
import { Type } from '../ast/type'
import { FieldDef } from '../ast/type-def'
import { Context } from '../scope'
import { vidToString } from '../scope/util'
import { MethodDef } from '../scope/vid'
import { VirtualFnType, VirtualType, virtualTypeToString } from '../typecheck'
import { unreachable } from '../util/todo'
import { MatchTree, unmatchedPaths } from './exhaust'

export interface SemanticError {
    code: number
    module: Module
    node: AstNode<any>
    message: string
    notes: string[]
}

export const semanticError = (
    code: number,
    ctx: Context,
    node: AstNode<any>,
    message: string,
    notes: string[] = []
): SemanticError => ({ code, module: ctx.moduleStack.at(-1)!, node, message, notes })

export const notFoundError = (
    ctx: Context,
    node: AstNode<any>,
    id: string,
    kind: string = 'identifier',
    notes?: string[]
): SemanticError => semanticError(1, ctx, node, `${kind} \`${id}\` not found`, notes)

export const notImplementedError = (ctx: Context, node: AstNode<any>, message?: string): SemanticError =>
    semanticError(2, ctx, node, `not implemented:${message ? ` ${message}` : ''}`)

export const unknownTypeError = (ctx: Context, node: AstNode<any>, type: VirtualType): SemanticError => {
    if (type.kind === 'unknown-type') {
        if (type.mismatchedBranches) {
            return mismatchedBranchesError(ctx, node, type.mismatchedBranches.then, type.mismatchedBranches.else)
        }
        if (type.mismatchedMatchClauses) {
            return mismatchedClausesError(ctx, node, type.mismatchedMatchClauses)
        }
    }
    return semanticError(3, ctx, node, 'unknown type')
}

export const typeError = (
    ctx: Context,
    node: AstNode<any>,
    actual: VirtualType,
    expected: VirtualType
): SemanticError => {
    if (actual.kind === 'unknown-type' && actual.mismatchedBranches) {
        return mismatchedBranchesError(ctx, node, actual.mismatchedBranches.then, actual.mismatchedBranches.else)
    }
    const message = `\
type error: expected ${virtualTypeToString(expected)}
            got      ${virtualTypeToString(actual)}`
    return semanticError(4, ctx, node, message)
}

export const mismatchedBranchesError = (
    ctx: Context,
    node: AstNode<any>,
    thenType: VirtualType,
    elseType: VirtualType | undefined
): SemanticError => {
    const message = elseType
        ? `\
if branches have incompatible types:
    then: \`${virtualTypeToString(thenType)}\`
    else: \`${virtualTypeToString(elseType)}\``
        : 'missing `else` clause'
    return semanticError(5, ctx, node, message)
}

/**
 * TODO: include clause ref for better error reporting
 */
export const mismatchedClausesError = (ctx: Context, node: AstNode<any>, types: VirtualType[]): SemanticError => {
    const typesStr = types.map(t => `    ${virtualTypeToString(t)}`).join('\n')
    const message = `match clauses have incompatible types:\n${typesStr}`
    return semanticError(6, ctx, node, message)
}

export const circularModuleError = (ctx: Context, module: Module): SemanticError => {
    const vid = vidToString(module.identifier)
    const stackVids = ctx.moduleStack.map(m => vidToString(m.identifier))
    const refChain = [...stackVids.slice(stackVids.indexOf(vid)), vid].join(' -> ')
    return semanticError(7, ctx, module, `circular module reference: ${refChain}`)
}

export const duplicateImportError = (ctx: Context, name: Name): SemanticError => {
    return semanticError(8, ctx, name, `duplicate import`)
}

export const selfImportError = (ctx: Context, name: Name): SemanticError => {
    return semanticError(9, ctx, name, `unnecessary self import`)
}

export const unreachableStatementError = (ctx: Context, statement: Statement): SemanticError => {
    return semanticError(10, ctx, statement, `unreachable statement`)
}

export const unexpectedTopLevelStatementError = (ctx: Context, statement: Statement): SemanticError => {
    return semanticError(11, ctx, statement, `unexpected top level statement`)
}

export const unexpectedInInstanceScopeError = (ctx: Context, statement: Statement): SemanticError => {
    return semanticError(12, ctx, statement, `unexpected statement within instance scope`)
}

export const noBodyFnError = (ctx: Context, fnDef: FnDef): SemanticError => {
    const msg = `fn \`${fnDef.name.value}\` has no body`
    return semanticError(13, ctx, fnDef.name, msg)
}

export const unnecessaryPubMethodError = (ctx: Context, fnDef: FnDef): SemanticError => {
    const msg = `trait method \`${fnDef.name.value}\` is always public`
    return semanticError(14, ctx, fnDef.name, msg)
}

export const unspecifiedParamTypeError = (ctx: Context, param: Param): SemanticError => {
    return semanticError(15, ctx, param, 'unspecified parameter type')
}

export const unexpectedPatternKindError = (ctx: Context, param: Param): SemanticError => {
    const notes = [`\`${param.pattern.kind}\` can only be used in match expressions`]
    return semanticError(16, ctx, param.pattern, 'unexpected pattern type', notes)
}

export const missingMethodImplsError = (ctx: Context, implDef: ImplDef, methodDefs: MethodDef[]): SemanticError => {
    const printParam = (param: Param, i: number): string => {
        const type = param.paramType ? `: ${virtualTypeToString(param.type!)}` : ''
        switch (param.pattern.expr.kind) {
            case 'name':
                return `${param.pattern.expr.value}${type}`
            case 'con-pattern':
                return `p${i}${type}`
            case 'hole':
                return `_${type}`
        }
        return unreachable()
    }
    const printFn = (fnDef: FnDef): string => {
        const returnType = fnDef.returnType ? `: ${virtualTypeToString((<VirtualFnType>fnDef.type!).returnType)}` : ''
        return `    fn ${fnDef.name.value}(${fnDef.params.map(printParam).join(', ')})${returnType}`
    }
    const methodSigs = methodDefs.map(m => printFn(m.fn)).join('\n')
    const msg = `missing implementations for methods:\n${methodSigs}`
    return semanticError(17, ctx, implDef.identifier.names.at(-1)!, msg)
}

export const methodNotDefinedError = (ctx: Context, fnDef: FnDef, methodVid: string): SemanticError => {
    const msg = `method \`${methodVid}\` is not defined`
    return semanticError(18, ctx, fnDef.name, msg)
}

export const expectedTraitError = (ctx: Context, id: Identifier): SemanticError => {
    return semanticError(19, ctx, id, 'expected trait')
}

export const topLevelVarUntypedError = (ctx: Context, varDef: VarDef): SemanticError => {
    return semanticError(20, ctx, varDef, 'top level variable must have explicit type')
}

export const topLevelVarNotDefinedError = (ctx: Context, varDef: VarDef): SemanticError => {
    return semanticError(21, ctx, varDef, 'top level variable must be defined')
}

export const notInFnScopeError = (ctx: Context, node: AstNode<any>): SemanticError => {
    return semanticError(22, ctx, node, 'outside of the function scope')
}

export const notInLoopScopeError = (ctx: Context, statement: Statement): SemanticError => {
    return semanticError(23, ctx, statement, 'outside of the loop')
}

export const privateAccessError = (ctx: Context, node: AstNode<any>, kind: string, name: string): SemanticError => {
    return semanticError(24, ctx, node, `${kind} \`${name}\` is private`)
}

export const vidResolveToModuleError = (ctx: Context, id: Identifier, name: string): SemanticError => {
    return semanticError(25, ctx, id, `\`${name}\` is a module`)
}

export const typeArgCountMismatchError = (
    ctx: Context,
    type: Type,
    paramCount: number,
    argCount: number
): SemanticError => {
    const msg = `expected ${paramCount} type arguments, got ${argCount}`
    return semanticError(26, ctx, type, msg)
}

export const argCountMismatchError = (
    ctx: Context,
    node: AstNode<any>,
    paramCount: number,
    argCount: number
): SemanticError => {
    const msg = `expected ${paramCount} arguments, got ${argCount}`
    return semanticError(27, ctx, node, msg)
}

export const missingFieldsError = (ctx: Context, call: CallOp, fields: FieldDef[]): SemanticError => {
    const msg = `missing fields: ${fields.map(f => `\`${f.name.value}\``).join(', ')}`
    return semanticError(28, ctx, call, msg)
}

export const nonCallableError = (ctx: Context, operand: Operand): SemanticError => {
    const msg = `type error: non-callable operand of type \`${virtualTypeToString(operand.type!)}\``
    return semanticError(29, ctx, operand, msg)
}

export const notIterableError = (ctx: Context, expr: Expr): SemanticError => {
    const msg = `not iterable expression of type ${virtualTypeToString(expr.type!)}`
    return semanticError(30, ctx, expr, msg)
}

export const unexpectedNamedArgError = (ctx: Context, arg: Arg): SemanticError => {
    const msg = `unexpected named argument \`${arg.name!.value}\``
    return semanticError(30, ctx, arg.name!, msg)
}

export const expectedTypeError = (ctx: Context, type: Identifier, kind: string): SemanticError => {
    const msg = `expected type, got \`${kind}\``
    return semanticError(31, ctx, type, msg)
}

export const nonDestructurableTypeError = (
    ctx: Context,
    patternExpr: PatternExpr,
    type: VirtualType
): SemanticError => {
    const msg = `non-destructurable type \`${virtualTypeToString(type)}\``
    return semanticError(32, ctx, patternExpr, msg)
}

export const unexpectedTypeError = (
    ctx: Context,
    node: AstNode<any>,
    expected: string,
    type: VirtualType
): SemanticError => {
    const msg = `expected ${expected}, got \`${virtualTypeToString(type)}\``
    return semanticError(35, ctx, node, msg)
}

export const narrowFieldAccessError = (ctx: Context, field: Name): SemanticError => {
    const msg = `field \`${field.value}\` is not defined in all variants`
    return semanticError(36, ctx, field, msg)
}

export const unreachableMatchClauseError = (ctx: Context, clause: MatchClause): SemanticError => {
    return semanticError(37, ctx, clause, 'unreachable match clause')
}

export const nonExhaustiveMatchError = (ctx: Context, match: MatchExpr, tree: MatchTree): SemanticError => {
    const ps = unmatchedPaths(tree.node)
    const pathsStr = ps.map(p => `    ${p} {}`).join('\n')
    const msg = `non-exhaustive match expression, unmatched paths:\n${pathsStr}`
    return semanticError(38, ctx, match, msg)
}

export const missingVarInitError = (ctx: Context, varDef: VarDef): SemanticError => {
    const msg = `missing variable initialization`
    return semanticError(39, ctx, varDef, msg)
}

export const noImplFoundError = (ctx: Context, name: Name, methodDef: MethodDef, operand: Operand): SemanticError => {
    const traitVid = vidToString(methodDef.rel.implDef.vid)
    const operandType = virtualTypeToString(operand.type!)
    const msg = `no impl of trait \`${traitVid}\` found for type \`${operandType}\``
    return semanticError(40, ctx, name, msg)
}

export const unexpectedRefutablePatternError = (ctx: Context, patternExpr: PatternExpr): SemanticError => {
    const msg = `unexpected refutable pattern`
    return semanticError(41, ctx, patternExpr, msg)
}
