import { AstNode, Module } from '../ast'
import { Context } from '../scope'
import { vidToString, VirtualIdentifier } from '../scope/vid'

export interface SemanticError {
    module: Module,
    node: AstNode<any>
    message: string
}

export const semanticError = (ctx: Context, node: AstNode<any>, message: string): SemanticError =>
    ({ module: ctx.moduleStack.at(-1)!, node, message })

export const notFoundError = (ctx: Context, node: AstNode<any>, vid: VirtualIdentifier): SemanticError =>
    semanticError(ctx, node, `\`${node.kind}\` \`${vidToString(vid)}\` not found`)

