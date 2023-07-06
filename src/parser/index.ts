import { ParseToken, TokenKind } from '../lexer/lexer'
import { LocationRange } from '../location'
import { Source } from '../source'

export const treeKinds = <const>[
    'error',
    'module',
    'statement',
    'use-stmt',
    'use-expr',
    'use-list',
    'var-def',
    'fn-def',
    'kind-def',
    'impl-def',
    'impl-for',
    'type-def',
    'type-con-params',
    'field-def',
    'type-con-list',
    'type-con',
    'return-stmt',
    'expr',
    'sub-expr',
    'operand',
    'list-expr',
    'infix-op',
    'add-op',
    'sub-op',
    'mult-op',
    'div-op',
    'exp-op',
    'mod-op',
    'access-op',
    'eq-op',
    'ne-op',
    'ge-op',
    'le-op',
    'gt-op',
    'lt-op',
    'and-op',
    'or-op',
    'assign-op',
    'prefix-op',
    'not-op',
    'spread-op',
    'postfix-op',
    'call-op',
    'con-op',
    'args',
    'closure-expr',
    'closure-params',
    'constructor',
    'con-params',
    'field-init',
    'identifier',
    'params',
    'param',
    'block',
    'type-annot',
    'type',
    'variant-type',
    'type-params',
    'type-param',
    'type-bounds',
    'fn-type',
    'fn-type-params',
    'if-expr',
    'while-expr',
    'for-expr',
    'match-expr',
    'match-clauses',
    'match-clause',
    'guard',
    'pattern',
    'con-pattern',
    'con-pattern-params',
    'field-pattern',
    'hole',
    'wildcard',
]
export type TreeKind = typeof treeKinds[number]

export type NodeKind = TokenKind | TreeKind

export interface ParseTree {
    kind: TreeKind,
    nodes: ParseNode[]
}

export type ParseNode = ParseToken | ParseTree

export const compactParseNode = (node: ParseNode): any => {
    if ('value' in node) {
        return { [node.kind]: node.value }
    } else {
        return { [node.kind]: node.nodes.map(n => compactParseNode(n)) }
    }
}

export const getLocationRange = (node: ParseNode): LocationRange => {
    const leftmostNode = (node: ParseNode): ParseToken => {
        if ('nodes' in node) {
            return leftmostNode(node.nodes[0])
        } else {
            return node
        }
    }
    const rightmostNode = (node: ParseNode): ParseToken => {
        if ('nodes' in node) {
            return rightmostNode(node.nodes.at(-1)!)
        } else {
            return node
        }
    }
    return { start: leftmostNode(node).location.start, end: rightmostNode(node).location.end }
}

export const parseNodeCode = (node: ParseNode, source: Source): string => {
    const range = getLocationRange(node)
    return source.code.slice(range.start, range.end + 1)
}
