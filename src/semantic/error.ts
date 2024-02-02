import { AstNode, Module } from '../ast'
import { Context } from '../scope'
import { VirtualType, virtualTypeToString } from '../typecheck'

export interface SemanticError {
    module: Module
    node: AstNode<any>
    message: string
}

export const semanticError = (ctx: Context, node: AstNode<any>, message: string): SemanticError => {
    // console.trace(message)
    return {
        module: ctx.moduleStack.at(-1)!,
        node,
        message
    }
}

export const notFoundError = (ctx: Context, node: AstNode<any>, id: string, name: string = node.kind): SemanticError =>
    semanticError(ctx, node, `${name} \`${id}\` not found`)

export const notImplementedError = (ctx: Context, node: AstNode<any>, message?: string): SemanticError =>
    semanticError(ctx, node, `not implemented:${message ? ` ${message}` : ''}`)

export const unknownTypeError = (node: AstNode<any>, type: VirtualType, ctx: Context): SemanticError => {
    if (type.kind === 'unknown-type') {
        if (type.mismatchedBranches) {
            return mismatchedBranchesError(node, type.mismatchedBranches.then, type.mismatchedBranches.else, ctx)
        }
        if (type.mismatchedMatchClauses) {
            return mismatchedClausesError(node, type.mismatchedMatchClauses, ctx)
        }
    }
    return semanticError(ctx, node, 'unknown type')
}

export const typeError = (
    node: AstNode<any>,
    actual: VirtualType,
    expected: VirtualType,
    ctx: Context
): SemanticError => {
    if (actual.kind === 'unknown-type' && actual.mismatchedBranches) {
        return mismatchedBranchesError(node, actual.mismatchedBranches.then, actual.mismatchedBranches.else, ctx)
    }
    const message = `\
type error: expected ${virtualTypeToString(expected)}
            got      ${virtualTypeToString(actual)}`
    return semanticError(ctx, node, message)
}

export const mismatchedBranchesError = (
    node: AstNode<any>,
    thenType: VirtualType,
    elseType: VirtualType | undefined,
    ctx: Context
): SemanticError => {
    const message = elseType
        ? `\
if branches have incompatible types:
    then: \`${virtualTypeToString(thenType)}\`
    else: \`${virtualTypeToString(elseType)}\``
        : 'missing `else` clause'
    return semanticError(ctx, node, message)
}

/**
 * TODO: include clause ref for better error reporting
 */
export const mismatchedClausesError = (node: AstNode<any>, types: VirtualType[], ctx: Context): SemanticError => {
    const typesStr = types.map(t => `    ${virtualTypeToString(t)}`).join('\n')
    const message = `match clauses have incompatible types:\n${typesStr}`
    return semanticError(ctx, node, message)
}
