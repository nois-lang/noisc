import { buildIdentifier, buildName, Identifier, Name } from './operand'
import { ParseNode } from '../parser'
import { AstNode, filterNonAstNodes } from './index'

export type Type = Identifier | FnType

export const buildType = (node: ParseNode): Type => {
    const n = filterNonAstNodes(node)[0]
    if (node.kind === 'type-annot') {
        return buildType(n)
    }
    if (n.kind === 'identifier') {
        return buildIdentifier(n)
    } else {
        return buildFnType(n)
    }
}

export interface Generic extends AstNode<'generic'> {
    name: Name
    bounds: Type[]
}

export const buildGeneric = (node: ParseNode): Generic => {
    const nodes = filterNonAstNodes(node)
    const name = buildName(nodes[0])
    const bounds = nodes.at(1)?.kind === 'generic-bounds' ? filterNonAstNodes(nodes[1]).map(buildType) : []
    return { kind: 'generic', parseNode: node, name, bounds }
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
