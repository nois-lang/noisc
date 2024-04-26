import { ParseNode, filterNonAstNodes } from '../parser'
import { Context } from '../scope'
import { Checked } from '../semantic'
import { AstNode } from './index'
import { Hole, buildHole } from './match'
import { Identifier, Name, buildIdentifier, buildName } from './operand'

export type Type = (Identifier | TypeBounds | FnType | Hole) & Partial<Checked>

export const buildType = (node: ParseNode, ctx: Context): Type => {
    const n = filterNonAstNodes(node)[0]
    if (node.kind === 'type-annot') {
        return buildType(n, ctx)
    } else if (n.kind === 'type-bounds') {
        const typeBounds = buildTypeBounds(n, ctx)
        if (typeBounds.bounds.length === 1) {
            return typeBounds.bounds[0]
        } else {
            return typeBounds
        }
    } else if (n.kind === 'hole') {
        return buildHole(n)
    } else {
        return buildFnType(n, ctx)
    }
}

export interface TypeBounds extends AstNode<'type-bounds'> {
    bounds: Identifier[]
}

export const buildTypeBounds = (node: ParseNode, ctx: Context): TypeBounds => {
    const nodes = filterNonAstNodes(node)
    const bounds = nodes.map(n => buildIdentifier(n, ctx))
    return { kind: 'type-bounds', parseNode: node, bounds }
}

export interface Generic extends AstNode<'generic'> {
    name: Name
    key?: string
    bounds: Identifier[]
}

export const buildGeneric = (node: ParseNode, ctx: Context): Generic => {
    const nodes = filterNonAstNodes(node)
    const name = buildName(nodes[0], ctx)
    const bounds = nodes.at(1) ? buildTypeBounds(nodes[1], ctx).bounds : []
    return { kind: 'generic', parseNode: node, name, bounds: bounds }
}

export interface FnType extends AstNode<'fn-type'> {
    generics: Generic[]
    paramTypes: Type[]
    returnType: Type
}

export const buildFnType = (node: ParseNode, ctx: Context): FnType => {
    const nodes = filterNonAstNodes(node)
    let i = 0
    const generics = nodes[i].kind === 'generics' ? filterNonAstNodes(nodes[i++]).map(n => buildGeneric(n, ctx)) : []
    const paramTypes = filterNonAstNodes(nodes[i++]).map(n => buildType(n, ctx))
    const returnType = buildType(filterNonAstNodes(nodes[i++])[0], ctx)
    return { kind: 'fn-type', parseNode: node, generics, paramTypes, returnType }
}
