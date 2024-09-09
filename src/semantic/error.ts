import { AstNode } from '../ast'
import { BinaryOp } from '../ast/op'
import { Identifier } from '../ast/operand'
import { Context, idToString } from '../scope'
import { Source } from '../source'
import { ErrorType_ } from '../typecheck'
import { assert } from '../util/todo'

export type SemanticError = {
    code: number
    source: Source
    node: AstNode
    message: string
    notes: string[]
}

export const semanticError = (
    code: number,
    ctx: Context,
    node: AstNode,
    message: string,
    notes: string[] = []
): SemanticError => {
    assert(ctx.moduleStack.length > 0)
    return { code, source: ctx.moduleStack.at(-1)!.source, node, message, notes }
}

export const notFoundError = (
    ctx: Context,
    node: AstNode,
    id: string,
    kind: string = 'identifier',
    notes?: string[]
): SemanticError => semanticError(1, ctx, node, `${kind} \`${id}\` not found`, notes)

export const invalidOperatorChainError = (ctx: Context, o1: BinaryOp, o2: BinaryOp): SemanticError => {
    const msg = `invalid operator chaining: \`${o1.kind}\` and \`${o2.kind}\``
    // TODO: composite location spans
    return semanticError(33, ctx, o1, msg)
}

export const duplicateDefError = (ctx: Context, def: AstNode): SemanticError => {
    const msg = `duplicate definition`
    return semanticError(42, ctx, def, msg)
}

export const duplicateUseError = (ctx: Context, useId: Identifier): SemanticError => {
    const msg = `duplicate use expression \`${idToString(useId)}\``
    return semanticError(43, ctx, useId, msg)
}

export const genericError = (ctx: Context, def: AstNode, msg: string = 'error', notes?: string[]): SemanticError => {
    return semanticError(44, ctx, def, msg, notes)
}

export const typeError = (ctx: Context, node: AstNode, e: ErrorType_): SemanticError => {
    const msg = `type error (${e.errorKind})${e.message ? `: ${e.message}` : ''}`
    return semanticError(45, ctx, node, msg)
}
