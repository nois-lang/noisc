import { TokenKind, lexerKeywordKinds } from '../../lexer/lexer'
import { Parser } from '../parser'
import { parseExpr } from './expr'
import { parseBlock, parseParam, parseStatement, parseUseStmt } from './statement'
import { parseTypeAnnot } from './type'

/**
 * Tokens that can be used as a name AST node depending on context.
 * Includes 'name' itself and all keyword tokens
 */
export const nameLikeTokens: TokenKind[] = ['name', ...lexerKeywordKinds]

export const prefixOpFirstTokens: TokenKind[] = ['excl', 'minus', 'period', 'plus']
export const postfixOpFirstTokens: TokenKind[] = ['o-paren']
export const infixOpFirstTokens: TokenKind[] = ['ampersand', 'asterisk', 'c-angle', 'caret', 'equals', 'excl', 'minus',
    'o-angle', 'percent', 'period', 'pipe', 'plus', 'slash']
export const exprFirstTokens: TokenKind[] = ['char', ...nameLikeTokens, 'if-keyword', 'while-keyword', 'for-keyword',
    'match-keyword', 'int', 'float', 'o-paren', 'string', 'o-bracket', 'pipe', ...prefixOpFirstTokens]
export const paramFirstTokens: TokenKind[] = [...nameLikeTokens, 'underscore']
export const useExprFirstTokens: TokenKind[] = [...nameLikeTokens, 'asterisk', 'o-brace']
export const fieldPatternFirstTokens: TokenKind[] = [...nameLikeTokens, 'period']
export const patternFollowTokens: TokenKind[] = ['c-paren', 'colon', 'comma', 'equals', 'if-keyword',
    'in-keyword', 'pipe']

/**
 * module ::= use-stmt* statement*
 */
export const parseModule = (parser: Parser): void => {
    const mark = parser.open()
    while (parser.at('use-keyword') && !parser.eof()) {
        parseUseStmt(parser)
    }
    while (!parser.eof()) {
        parseStatement(parser)
    }
    parser.close(mark, 'module')
}

/**
 * args ::= O-PAREN (expr (COMMA expr)*)? COMMA? C-PAREN
 */
export const parseArgs = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-paren')
    while (!parser.at('c-paren') && !parser.eof()) {
        parseExpr(parser)
        if (!parser.at('c-paren')) {
            parser.expect('comma')
        }
    }
    parser.expect('c-paren')
    parser.close(mark, 'args')
}

/**
 * closure-expr ::= closure-params type-annot? (block | expr)
 */
export const parseClosureExpr = (parser: Parser): void => {
    const mark = parser.open()
    parseClosureParams(parser)
    if (parser.at('colon')) {
        parseTypeAnnot(parser)
    }
    if (parser.at('o-brace')) {
        parseBlock(parser)
    } else if (parser.atAny(exprFirstTokens)) {
        parseExpr(parser)
    } else {
        parser.advanceWithError('block or expression expected')
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

/**
 * con-op ::= O-PAREN (field-init (COMMA field-init)*)? COMMA? C-PAREN
 */
export const parseConOp = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-paren')
    while (parser.atAny(paramFirstTokens) && !parser.eof()) {
        parseFieldInit(parser)
        if (!parser.at('c-paren')) {
            parser.expect('comma')
        }
    }
    parser.expect('c-paren')
    parser.close(mark, 'con-op')
}

/**
 * field-init ::= NAME COLON expr
 */
export const parseFieldInit = (parser: Parser): void => {
    const mark = parser.open()
    parser.expectAny(nameLikeTokens)
    parser.expect('colon')
    parseExpr(parser)
    parser.close(mark, 'field-init')
}

export const parseTodo = (parser: Parser): void => {
    parser.advanceWithError('todo')
}
