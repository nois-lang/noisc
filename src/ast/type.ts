import { buildIdentifier, buildName, Identifier, Name } from './operand'
import { ParseNode, ParseTree } from '../parser'
import { AstNode, filterNonAstNodes } from './index'

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

export interface VariantType extends AstNode<'variant-type'> {
    identifier: Identifier
    typeParams: TypeParam[]
}

export type TypeParam = Type | Generic

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
                .map(buildTypeParam)
            : [],
    }
}

export const buildTypeParam = (node: ParseNode): TypeParam => {
    const nodes = filterNonAstNodes(node)
    if (nodes[0].kind === 'type') {
        return buildType(nodes[0])
    } else {
        const name = buildName(nodes[0])
        const bounds = filterNonAstNodes(nodes[1]).map(buildType)
        return { kind: 'generic', parseNode: node, name, bounds }
    }
}

export interface FnType extends AstNode<'fn-type'> {
    paramTypes: Type[]
    returnType: Type
}

export const buildFnType = (node: ParseNode): FnType => {
    const nodes = filterNonAstNodes(node)
    const paramTypes = filterNonAstNodes(nodes[0]).map(buildType)
    const returnType = buildType(filterNonAstNodes(nodes[1])[0])
    return { kind: 'fn-type', parseNode: node, paramTypes, returnType }
}
