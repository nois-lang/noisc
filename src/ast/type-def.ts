import { ParseNode, filterNonAstNodes } from '../parser'
import { Context } from '../scope'
import { Checked, Typed } from '../semantic'
import { AstNode } from './index'
import { Name, buildName } from './operand'
import { Generic, Type, buildGeneric, buildType } from './type'

export interface TypeDef extends AstNode<'type-def'>, Partial<Checked> {
    name: Name
    generics: Generic[]
    variants: Variant[]
    pub: boolean
}

export const buildTypeDef = (node: ParseNode, ctx: Context): TypeDef => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    const pub = nodes[idx].kind === 'pub-keyword'
    if (pub) idx++
    // skip type-keyword
    idx++
    const name = buildName(nodes[idx++], ctx)
    const generics =
        nodes.at(idx)?.kind === 'generics' ? filterNonAstNodes(nodes[idx++]).map(n => buildGeneric(n, ctx)) : []
    let variants: Variant[] = []
    if (nodes.at(idx)?.kind === 'variant-list') {
        variants = filterNonAstNodes(nodes[idx++]).map(n => buildTypeCon(n, ctx))
    } else if (nodes.at(idx)?.kind === 'variant-params') {
        // when variant parameters are specified, create a single variant with the same name as the type, so
        // Foo         -> no variants
        // Foo()       -> variant Foo::Foo()
        // Foo(x: Int) -> variant Foo::Foo(x: Int)
        const fieldDefs = filterNonAstNodes(nodes[idx]).map(n => buildFieldDef(n, ctx))
        variants = [{ kind: 'variant', parseNode: nodes[idx++], name, fieldDefs }]
    }
    return { kind: 'type-def', parseNode: node, name, generics, variants, pub }
}

export interface Variant extends AstNode<'variant'>, Partial<Typed> {
    name: Name
    fieldDefs: FieldDef[]
}

export const buildTypeCon = (node: ParseNode, ctx: Context): Variant => {
    const nodes = filterNonAstNodes(node)
    const name = buildName(nodes[0], ctx)
    const fieldDefs = nodes.at(1) ? filterNonAstNodes(nodes[1]).map(n => buildFieldDef(n, ctx)) : []
    return { kind: 'variant', parseNode: node, name, fieldDefs }
}

export interface FieldDef extends AstNode<'field-def'>, Partial<Typed> {
    name: Name
    fieldType: Type
    pub: boolean
}

export const buildFieldDef = (node: ParseNode, ctx: Context): FieldDef => {
    const nodes = filterNonAstNodes(node)
    let idx = 0
    const pub = nodes[idx].kind === 'pub-keyword'
    if (pub) idx++
    const name = buildName(nodes[idx++], ctx)
    const fieldType = buildType(filterNonAstNodes(nodes[idx++])[0], ctx)
    return { kind: 'field-def', parseNode: node, name, fieldType, pub }
}
