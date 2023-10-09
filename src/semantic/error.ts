import { AstNode, Module } from '../ast'
import { Context } from '../scope'
import { VirtualType, virtualTypeToString } from '../typecheck'

export interface SemanticError {
    module: Module
    node: AstNode<any>
    message: string
}

export const semanticError = (ctx: Context, node: AstNode<any>, message: string): SemanticError => {
    return ({ module: ctx.moduleStack.at(-1)!, node, message })
}

export const notFoundError = (ctx: Context, node: AstNode<any>, id: string, name: string = node.kind): SemanticError =>
    semanticError(ctx, node, `${name} \`${id}\` not found`)

export const notImplementedError = (ctx: Context, node: AstNode<any>, message?: string): SemanticError =>
    semanticError(ctx, node, 'not implemented:' + (message ? ' ' + message : ''))

export const typeError = (node: AstNode<any>, actual: VirtualType, expected: VirtualType, ctx: Context): SemanticError => {
    const message = `\
type error: expected ${virtualTypeToString(expected)}
            got      ${virtualTypeToString(actual)}`
    return semanticError(ctx, node, message)
}
