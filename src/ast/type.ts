import { buildIdentifier, buildName, Identifier, Name } from './operand'
import { ParseNode } from '../parser'
import { AstNode, filterNonAstNodes } from './index'
import { buildHole, Hole } from './match'

export type Type = Identifier | TypeBounds | FnType | Hole

export const buildType = (node: ParseNode): Type => {
    const n = filterNonAstNodes(node)[0]
    if (node.kind === 'type-annot') {
        return buildType(n)
    } else if (n.kind === 'type-bounds') {
        const typeBounds = buildTypeBounds(n)
        if (typeBounds.bounds.length === 1) {
            return typeBounds.bounds[0]
        } else {
            return typeBounds
        }
    } else if (n.kind === 'hole') {
        return buildHole(n)
    } else {
        return buildFnType(n)
    }
}

export interface TypeBounds extends AstNode<'type-bounds'> {
    bounds: Identifier[]
}

export const buildTypeBounds = (node: ParseNode): TypeBounds => {
    const nodes = filterNonAstNodes(node)
    const bounds = nodes.map(buildIdentifier)
    return { kind: 'type-bounds', parseNode: node, bounds }
}

export interface Generic extends AstNode<'generic'> {
    name: Name
    bounds: Identifier[]
}

export const buildGeneric = (node: ParseNode): Generic => {
    const nodes = filterNonAstNodes(node)
    const name = buildName(nodes[0])
    const bounds = nodes.at(1) ? buildTypeBounds(nodes[1]).bounds : []
    return { kind: 'generic', parseNode: node, name, bounds: bounds }
}

export interface FnType extends AstNode<'fn-type'> {
    generics: Generic[]
    paramTypes: Type[]
    returnType: Type
}

export const buildFnType = (node: ParseNode): FnType => {
    const nodes = filterNonAstNodes(node)
    const paramTypes = filterNonAstNodes(nodes[0]).map(buildType)
    const returnType = buildType(filterNonAstNodes(nodes[1])[0])
    // TODO figure out fn-type syntax for generics
    return { kind: 'fn-type', parseNode: node, generics: [], paramTypes, returnType }
}
