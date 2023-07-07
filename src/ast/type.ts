import { buildIdentifier, buildName, Identifier, Name } from './operand'
import { ParseNode, ParseTree } from '../parser'
import { AstNode, filterNonAstNodes } from './index'
import { Identified } from '../semantic/identify'

export type Type = VariantType | FnType

export const buildType = (node: ParseNode): Type => {
    const n = filterNonAstNodes(node)[0]
    if (node.kind === 'type-annot') {
        return buildType(n)
    }
    if (n.kind === 'variant-type') {
        return buildVariantType(n)
    } else {
        return buildFnType(n)
    }
}

export interface VariantType extends AstNode<'variant-type'>, Partial<Identified> {
    identifier: Identifier
    typeParams: Type[]
}

export interface Generic extends AstNode<'generic'> {
    name: Name
    bounds: Type[]
}

export const buildVariantType = (node: ParseNode): VariantType => {
    const nodes = filterNonAstNodes(node)
    if (node.kind === 'type-annot') {
        return buildVariantType(nodes[0])
    }
    const nameNode = nodes[0]
    const paramsNode = nodes.at(1)
    return {
        kind: 'variant-type',
        parseNode: node,
        identifier: buildIdentifier(nameNode),
        typeParams: paramsNode
            ? (<ParseTree>paramsNode).nodes
                .filter(n => n.kind === 'type-param')
                .map(buildType)
            : [],
    }
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
