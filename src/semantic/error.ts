import { AstNode, Module } from '../ast'
import { Context } from '../scope'

export interface SemanticError {
    module: Module,
    node: AstNode<any>
    message: string
}

export const semanticError = (ctx: Context, node: AstNode<any>, message: string): SemanticError =>
    ({ module: ctx.moduleStack.at(-1)!, node, message })

export const notFoundError = (ctx: Context, node: AstNode<any>, id: string, name: string = node.kind): SemanticError =>
    semanticError(ctx, node, `${name} ${id} not found`)

