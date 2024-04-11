import { Parser } from '..'
import { TokenKind } from '../../lexer/lexer'
import { parseBlock, parseParam, parseStatement, parseUseStmt } from './statement'
import { parseTypeAnnot } from './type'

/**
 * Tokens that can be used as a name AST node depending on context.
 * Includes 'name' itself and all keyword tokens
 */
export const nameLikeTokens: TokenKind[] = [
    'name',
    'use-keyword',
    'type-keyword',
    'trait-keyword',
    'impl-keyword',
    'let-keyword',
    'fn-keyword',
    'if-keyword',
    'else-keyword',
    'return-keyword',
    'break-keyword',
    'while-keyword',
    'for-keyword',
    'in-keyword',
    'match-keyword',
    'pub-keyword'
]

export const infixOpFirstTokens: TokenKind[] = [
    'ampersand',
    'asterisk',
    'c-angle',
    'caret',
    'equals',
    'excl',
    'minus',
    'o-angle',
    'percent',
    'pipe',
    'plus',
    'slash'
]
export const numberFirstTokens: TokenKind[] = ['minus', 'int', 'float']
export const exprFirstTokens: TokenKind[] = [
    ...nameLikeTokens,
    'char',
    'if-keyword',
    'while-keyword',
    'for-keyword',
    'match-keyword',
    ...numberFirstTokens,
    'bool',
    'o-paren',
    'o-bracket',
    'o-angle',
    'd-quote',
    'pipe'
]
export const paramFirstTokens: TokenKind[] = [...nameLikeTokens, 'underscore', 'pub-keyword']
export const useExprFirstTokens: TokenKind[] = [...nameLikeTokens, 'o-brace']
export const fieldPatternFirstTokens: TokenKind[] = [...nameLikeTokens, 'period']

/**
 * module ::= use-stmt* statement*
 */
export const parseModule = (parser: Parser): void => {
    const mark = parser.open()
    while (parser.atOptionalFirst('pub-keyword', 'use-keyword') && !parser.eof()) {
        parseUseStmt(parser)
    }
    while (!parser.eof()) {
        parseStatement(parser)
    }
    parser.close(mark, 'module')
}

/**
 * TODO: closure generics
 * closure-expr ::= closure-params type-annot? (block | statement)
 */
export const parseClosureExpr = (parser: Parser): void => {
    const mark = parser.open()
    parseClosureParams(parser)
    if (parser.at('colon')) {
        parseTypeAnnot(parser)
    }
    if (parser.at('o-brace')) {
        parseBlock(parser)
    } else {
        parseStatement(parser)
    }
    parser.close(mark, 'closure-expr')
}

/**
 * closure-params ::= PIPE (param (COMMA param)*)? COMMA? PIPE
 */
export const parseClosureParams = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('pipe')
    while (!parser.at('pipe') && !parser.eof()) {
        parseParam(parser)
        if (!parser.at('pipe')) {
            parser.expect('comma')
        }
    }
    parser.expect('pipe')
    parser.close(mark, 'closure-params')
}
