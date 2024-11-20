import { BaseAstNode } from '.'
import { ParseNode, filterNonAstNodes } from '../parser'
import { Context } from '../scope'
import { Hole, buildHole } from './match'
import { Identifier, Name, buildIdentifier, buildName } from './operand'

export type Type = Identifier | FnType | Hole | Name

export const buildType = (node: ParseNode, ctx: Context): Type => {
    const n = filterNonAstNodes(node)[0]
    if (node.kind === 'type-annot') {
        return buildType(n, ctx)
    } else if (n.kind === 'identifier') {
        return buildIdentifier(n, ctx)
    } else if (n.kind === 'hole') {
        return buildHole(n)
    } else {
        return buildFnType(n, ctx)
    }
}

export type TypeBounds = BaseAstNode & {
    kind: 'type-bounds'
    bounds: Identifier[]
}

export const buildTypeBounds = (node: ParseNode, ctx: Context): TypeBounds => {
    const nodes = filterNonAstNodes(node)
    const bounds = nodes.map(n => buildIdentifier(n, ctx))
    return { kind: 'type-bounds', parseNode: node, bounds }
}

export type TypeParam = BaseAstNode & {
    kind: 'type-param'
    name: Name
    key?: string
    bounds: Identifier[]
}

export const buildTypeParam = (node: ParseNode, ctx: Context): TypeParam => {
    const nodes = filterNonAstNodes(node)
    const name = buildName(nodes[0], ctx)
    const bounds = nodes.at(1) ? buildTypeBounds(nodes[1], ctx).bounds : []
    return { kind: 'type-param', parseNode: node, name, bounds: bounds }
}

export type FnType = BaseAstNode & {
    kind: 'fn-type'
    typeParams: TypeParam[]
    paramTypes: ParamType[]
    returnType: Type
}

export const buildFnType = (node: ParseNode, ctx: Context): FnType => {
    const nodes = filterNonAstNodes(node)
    let i = 0
    // skip fn-keyword
    i++
    const generics =
        nodes[i].kind === 'type-params' ? filterNonAstNodes(nodes[i++]).map(n => buildTypeParam(n, ctx)) : []
    const paramTypes = filterNonAstNodes(nodes[i++]).map(n => buildParamType(n, ctx))
    const returnType = buildType(filterNonAstNodes(nodes[i++])[0], ctx)
    return { kind: 'fn-type', parseNode: node, typeParams: generics, paramTypes, returnType }
}

export type ParamType = BaseAstNode & {
    kind: 'param-type'
    name: Name
    paramType: Type
}

export const buildParamType = (node: ParseNode, ctx: Context): ParamType => {
    const nodes = filterNonAstNodes(node)
    let i = 0
    const name = buildName(nodes[i++], ctx)
    const paramType = buildType(nodes[i++], ctx)
    return { kind: 'param-type', parseNode: node, name, paramType }
}
