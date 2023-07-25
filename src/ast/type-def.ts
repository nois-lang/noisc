import { buildName, Name } from './operand'
import { ParseNode } from '../parser'
import { AstNode, filterNonAstNodes } from './index'
import { buildGeneric, buildType, Generic, Type } from './type'
import { Typed } from '../typecheck'

export interface TypeDef extends AstNode<'type-def'> {
    name: Name
    generics: Generic[]
    variants: TypeCon[]
}

export const buildTypeDef = (node: ParseNode): TypeDef => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    const name = buildName(nodes[idx++])
    const generics = nodes.at(idx)?.kind === 'generics' ? filterNonAstNodes(nodes[idx++]).map(buildGeneric) : []
    let variants: TypeCon[] = []
    if (nodes.at(idx)?.kind === 'type-con-list') {
        variants = filterNonAstNodes(nodes[idx++]).map(buildTypeCon)
    } else if (nodes.at(idx)?.kind === 'type-con-params') {
        const fieldDefs = filterNonAstNodes(nodes[idx]).map(buildFieldDef)
        variants = [{ kind: 'type-con', parseNode: nodes[idx++], name, fieldDefs }]
    }
    return { kind: 'type-def', parseNode: node, name, generics, variants }
}

export interface TypeCon extends AstNode<'type-con'>, Partial<Typed> {
    name: Name
    fieldDefs: FieldDef[]
}

export const buildTypeCon = (node: ParseNode): TypeCon => {
    const nodes = filterNonAstNodes(node)
    const name = buildName(nodes[0])
    const fieldDefs = nodes.at(1) ? filterNonAstNodes(nodes[1]).map(buildFieldDef) : []
    return { kind: 'type-con', parseNode: node, name, fieldDefs }
}

export interface FieldDef extends AstNode<'field-def'> {
    name: Name
    fieldType: Type
}

export const buildFieldDef = (node: ParseNode): FieldDef => {
    const nodes = filterNonAstNodes(node)
    const name = buildName(nodes[0])
    const fieldType = buildType(filterNonAstNodes(nodes[1])[0])
    return { kind: 'field-def', parseNode: node, name, fieldType }
}
