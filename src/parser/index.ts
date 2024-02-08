import { LexerToken, TokenKind, lexerDynamicKinds } from '../lexer/lexer'
import { Span } from '../location'
import { Source } from '../source'
import { nameLikeTokens } from './fns'

export const treeKinds = <const>[
    'error',
    'module',
    'statement',
    'use-stmt',
    'use-expr',
    'use-list',
    'var-def',
    'fn-def',
    'generics',
    'generic',
    'generic-bounds',
    'params',
    'param',
    'trait-def',
    'impl-def',
    'impl-for',
    'type-def',
    'variant-params',
    'field-def',
    'variant-list',
    'variant',
    'return-stmt',
    'break-stmt',
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
    'neg-op',
    'spread-op',
    'call',
    'arg',
    'closure-expr',
    'closure-params',
    'identifier',
    'block',
    'type-annot',
    'type',
    'variant-type',
    'type-args',
    'type-bounds',
    'fn-type',
    'fn-type-params',
    'if-expr',
    'if-let-expr',
    'while-expr',
    'for-expr',
    'match-expr',
    'match-clauses',
    'match-clause',
    'guard',
    'pattern',
    'pattern-bind',
    'pattern-expr',
    'con-pattern',
    'con-pattern-params',
    'field-pattern',
    'hole'
]
export type TreeKind = (typeof treeKinds)[number]

export type NodeKind = TokenKind | TreeKind

export interface ParseTree {
    kind: TreeKind
    nodes: ParseNode[]
}

export type ParseNode = LexerToken | ParseTree

export const parseNodeKinds: NodeKind[] = [...lexerDynamicKinds, ...nameLikeTokens, ...treeKinds, 'pub-keyword']

export const filterNonAstNodes = (node: ParseNode): ParseNode[] =>
    (<ParseTree>node).nodes.filter(n => parseNodeKinds.includes(n.kind))

export const compactParseNode = (node: ParseNode): any => {
    if ('value' in node) {
        return { [node.kind]: node.value }
    } else {
        return { [node.kind]: node.nodes.map(n => compactParseNode(n)) }
    }
}

export const getSpan = (node: ParseNode): Span => {
    const leftmostNode = (node: ParseNode): LexerToken => {
        if ('nodes' in node) {
            return leftmostNode(node.nodes[0])
        } else {
            return node
        }
    }
    const rightmostNode = (node: ParseNode): LexerToken => {
        if ('nodes' in node) {
            return rightmostNode(node.nodes.at(-1)!)
        } else {
            return node
        }
    }
    return { start: leftmostNode(node).span.start, end: rightmostNode(node).span.end }
}

export const parseNodeCode = (node: ParseNode, source: Source): string => {
    const range = getSpan(node)
    return source.code.slice(range.start, range.end)
}
