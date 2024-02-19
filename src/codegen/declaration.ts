import { Module } from '../ast'
import { Statement, UseExpr } from '../ast/statement'
import { ParseNode } from '../parser'
import { unreachable } from '../util/todo'

export const emitDeclaration = (module: Module): string => {
    return [
        ...module.useExprs.map(emitUseExpr),
        ...module.block.statements
            .map(emitStatement)
            .filter(s => !!s)
            .map(s => s!)
    ].join('\n')
}

export const emitUseExpr = (useExpr: UseExpr): string => {
    return `${useExpr.pub ? 'pub ' : ''}use ${emitParseNode(useExpr.parseNode)}`
}

export const emitStatement = (statement: Statement): string | undefined => {
    switch (statement.kind) {
        case 'var-def':
            if (statement.pub) return undefined
            return `pub ${emitParseNode(statement.pattern.parseNode)}`
        case 'fn-def':
            if (!statement.pub) return undefined
            // TODO
            const generics = ''
            // TODO
            const params = ''
            // TODO
            const returnType = ''
            return `pub fn ${statement.name.value}${generics}(${params})${returnType}`
        case 'trait-def':
            if (!statement.pub) return undefined
            // TODO
            return ``
        case 'impl-def':
            // TODO
            return ``
        case 'type-def':
            // TODO
            return undefined
        case 'return-stmt':
        case 'break-stmt':
        case 'operand-expr':
        case 'unary-expr':
        case 'binary-expr':
            return unreachable()
    }
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
