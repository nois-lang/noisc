import { Parser } from '..'
import { TokenKind, lexerKeywordKinds } from '../../lexer/lexer'
import { parseStatement, parseUseStmt } from './statement'

/**
 * Tokens that can be used as a name AST node depending on context.
 * Includes 'name' itself and all keyword tokens
 */
export const nameLikeTokens: TokenKind[] = ['name', ...lexerKeywordKinds]

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
    'o-brace',
    'o-angle',
    'd-quote'
]
export const paramFirstTokens: TokenKind[] = [...nameLikeTokens, 'underscore']
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
