import { AstNode } from '../ast'
import { Context } from '../scope'

/**
 * Resolve every name to its definition
 */
export const resolveName = (node: AstNode, ctx: Context): void => {
    switch (node.kind) {
        case 'module': {
            for (const statement of node.block.statements) {
                resolveName(statement, ctx)
            }
            break
        }
        case 'use-expr':
        case 'variant':
        case 'return-stmt':
        case 'break-stmt':
        case 'arg':
        case 'block':
        case 'param':
        case 'type-bounds':
        case 'fn-type':
        case 'generic':
        case 'if-expr':
        case 'match-clause':
        case 'pattern':
        case 'con-pattern':
        case 'list-pattern':
        case 'field-pattern':
        case 'hole':
        case 'identifier':
        case 'name':
        case 'string-interpolated':
        case 'operand-expr':
        case 'unary-expr':
        case 'binary-expr':
        case 'closure-expr':
        case 'list-expr':
        case 'if-let-expr':
        case 'while-expr':
        case 'for-expr':
        case 'match-expr':
        case 'var-def':
        case 'fn-def':
        case 'trait-def':
        case 'impl-def':
        case 'type-def':
        case 'field-def':
        case 'string-literal':
        case 'char-literal':
        case 'int-literal':
        case 'float-literal':
        case 'bool-literal':
        case 'add-op':
        case 'sub-op':
        case 'mult-op':
        case 'div-op':
        case 'exp-op':
        case 'mod-op':
        case 'eq-op':
        case 'ne-op':
        case 'ge-op':
        case 'le-op':
        case 'gt-op':
        case 'lt-op':
        case 'and-op':
        case 'or-op':
        case 'assign-op':
        case 'method-call-op':
        case 'field-access-op':
        case 'call-op':
        case 'unwrap-op':
        case 'bind-op':
        case 'await-op':
    }
}
