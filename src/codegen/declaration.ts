import { Module, Param } from '../ast'
import { Statement, UseExpr } from '../ast/statement'
import { FieldDef } from '../ast/type-def'
import { ParseNode } from '../parser'
import { unreachable } from '../util/todo'
import { indent } from './js'

export const emitDeclaration = (module: Module): string => {
    return [
        ...module.useExprs.map(emitUseExpr),
        ...module.block.statements
            .map(s => emitStatement(s))
            .filter(s => !!s)
            .map(s => s!)
    ].join('\n')
}

export const emitUseExpr = (useExpr: UseExpr): string => {
    return `${useExpr.pub ? 'pub ' : ''}use ${emitParseNode(useExpr.parseNode)}`
}

export const emitStatement = (statement: Statement, pubOnly = true): string | undefined => {
    switch (statement.kind) {
        case 'var-def':
            if (!statement.pub) return undefined
            return `pub let ${emitParseNode(statement.pattern.parseNode)}: ${emitParseNode(
                statement.varType!.parseNode
            )}`
        case 'fn-def': {
            if (pubOnly && !statement.pub) return undefined
            const generics =
                statement.generics?.length > 0
                    ? `<${statement.generics.map(g => emitParseNode(g.parseNode)).join(', ')}>`
                    : ''
            const params = statement.params.map(emitParam).join(', ')
            const returnType = statement.returnType ? `: ${emitParseNode(statement.returnType.parseNode)}` : ''
            const block = statement.block ? ' {}' : ''
            return `${statement.pub ? 'pub ' : ''}fn ${statement.name.value}${generics}(${params})${returnType}${block}`
        }
        case 'trait-def': {
            if (!statement.pub) return undefined
            const generics =
                statement.generics?.length > 0
                    ? `<${statement.generics.map(g => emitParseNode(g.parseNode)).join(', ')}>`
                    : ''
            const statements = statement.block.statements
                .map(s => emitStatement(s, false))
                .filter(s => !!s)
                .map(s => s!)
            const block = statements.length > 0 ? `{\n${statements.map(s => indent(s)).join('\n')}\n}` : '{}'
            return `pub trait ${statement.name.value}${generics} ${block}`
        }
        case 'impl-def': {
            const generics =
                statement.generics?.length > 0
                    ? `<${statement.generics.map(g => emitParseNode(g.parseNode)).join(', ')}> `
                    : ''
            if (statement.forTrait) {
                const id = emitParseNode(statement.identifier.parseNode)
                const forTrait = emitParseNode(statement.forTrait.parseNode)
                return `impl ${generics}${id} for ${forTrait} {}`
            }
            const statements = statement.block.statements
                .map(s => emitStatement(s))
                .filter(s => !!s)
                .map(s => s!)
            const block = statements.length > 0 ? `{\n${statements.map(s => indent(s)).join('\n')}\n}` : '{}'
            return `impl ${generics}${emitParseNode(statement.identifier.parseNode)} ${block}`
        }
        case 'type-def': {
            if (!statement.pub) return undefined
            const generics =
                statement.generics?.length > 0
                    ? `<${statement.generics.map(g => emitParseNode(g.parseNode)).join(', ')}>`
                    : ''
            const variants = statement.variants.map(v => {
                const fields = v.fieldDefs
                    .map(emitFieldDef)
                    .filter(f => !!f)
                    .map(f => f!)
                const fieldDefs = v.fieldDefs.length > 0 ? `(${fields})` : ''
                return `${v.name.value}${fieldDefs}`
            })
            const block = variants.length > 0 ? ` {\n${variants.map(s => indent(s)).join(',\n')}\n}` : ''
            return `pub type ${statement.name.value}${generics}${block}`
        }
        default:
            return unreachable(statement.kind)
    }
}

export const emitParam = (param: Param): string => {
    return (
        emitParseNode(param.pattern.parseNode) +
        (param.paramType ? `: ${emitParseNode(param.paramType.parseNode)}` : '')
    )
}

export const emitFieldDef = (fieldDef: FieldDef): string | undefined => {
    if (!fieldDef.pub) return undefined
    return `pub ${fieldDef.name.value}: ${emitParseNode(fieldDef.fieldType.parseNode)}`
}

export const emitParseNode = (node: ParseNode): string => {
    if ('value' in node) {
        return node.value
    }
    if (node.kind === 'block') {
        return node.nodes.map(emitParseNode).join('\n')
    }
    return node.nodes.map(emitParseNode).join('')
}
