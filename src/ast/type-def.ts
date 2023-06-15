import { AstNode, buildType, filterNonAstNodes, Type } from './index'
import { ParseNode } from '../parser/parser'
import { buildIdentifier, Identifier } from './operand'

export interface TypeDef extends AstNode<'type-def'> {
    identifier: Identifier
    typeParams: Type[]
    variants: TypeCon[]
}

export const buildTypeDef = (node: ParseNode): TypeDef => {
    const nodes = filterNonAstNodes(node)
    const { identifier, typeParams } = buildType(nodes[0])
    let variants: TypeCon[] = []
    if (nodes.at(1)?.kind === 'type-con-list') {
        variants = filterNonAstNodes(nodes[1]).map(buildTypeCon)
    } else if (nodes.at(1)?.kind === 'type-con-params') {
        const fieldDefs = filterNonAstNodes(nodes[1]).map(buildFieldDef)
        variants = [{ type: 'type-con', parseNode: nodes[1], identifier, fieldDefs }]
    }
    return { type: 'type-def', parseNode: node, identifier, typeParams, variants }
}

export interface TypeCon extends AstNode<'type-con'> {
    identifier: Identifier
    fieldDefs: FieldDef[]
}

export const buildTypeCon = (node: ParseNode): TypeCon => {
    const nodes = filterNonAstNodes(node)
    const identifier = buildIdentifier(nodes[0])
    const fieldDefs = nodes.at(1) ? filterNonAstNodes(nodes[1]).map(buildFieldDef) : []
    return { type: 'type-con', parseNode: node, identifier, fieldDefs }
}

export interface FieldDef extends AstNode<'field-def'> {
    identifier: Identifier
    fieldType: Type
}

export const buildFieldDef = (node: ParseNode): FieldDef => {
    const nodes = filterNonAstNodes(node)
    const identifier = buildIdentifier(nodes[0])
    const fieldType = buildType(filterNonAstNodes(nodes[1])[0])
    return { type: 'field-def', parseNode: node, identifier, fieldType }
}
