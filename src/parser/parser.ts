import { LexerTokenKind, Token } from '../lexer/lexer'

export const treeTokenKinds = <const>[
    'error',
    'program',
    'statements',
    'statement',
    'variable-def',
    'type-def',
    'return-stmt',
    'expr',
    'operand',
    'infix-operator',
    'prefix-op',
    'postfix-op',
    'call-op',
    'args',
    'function-expr',
    'block',
    'params',
    'param',
    'trailing-comma',
    'type',
    'type-params',
    'if-expr'
]
export type TreeTokenKind = typeof treeTokenKinds[number]

export type TokenKind = LexerTokenKind | TreeTokenKind

export interface SyntaxTree {
    kind: TreeTokenKind,
    nodes: Node[]
}

export type Node = Token | SyntaxTree
