import { syntaxError } from '../../error'
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

export const prefixOpFirstTokens: TokenKind[] = ['excl', 'minus', 'period']
export const postfixOpFirstTokens: TokenKind[] = ['o-paren']
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
    'period',
    'pipe',
    'plus',
    'slash'
]
export const exprFirstTokens: TokenKind[] = [
    'char',
    ...nameLikeTokens,
    'if-keyword',
    'while-keyword',
    'for-keyword',
    'match-keyword',
    'int',
    'float',
    'string',
    'o-paren',
    'o-bracket',
    'o-angle',
    'pipe',
    ...prefixOpFirstTokens
]
export const paramFirstTokens: TokenKind[] = [...nameLikeTokens, 'underscore', 'pub-keyword']
export const useExprFirstTokens: TokenKind[] = [...nameLikeTokens, 'o-brace']
export const fieldPatternFirstTokens: TokenKind[] = [...nameLikeTokens, 'period']
export const patternFollowTokens: TokenKind[] = [
    'c-paren',
    'colon',
    'comma',
    'equals',
    'if-keyword',
    'in-keyword',
    'pipe'
]

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
 * closure-expr ::= closure-params type-annot? block
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
        parser.advanceWithError(syntaxError(parser, 'expected block'))
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
 * pos-call ::= O-PAREN (expr (COMMA expr)*)? COMMA? C-PAREN
 */
export const parsePosCall = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-paren')
    while (!parser.at('c-paren') && !parser.eof()) {
        parseExpr(parser)
        if (!parser.at('c-paren')) {
            parser.expect('comma')
        }
    }
    parser.expect('c-paren')
    parser.close(mark, 'pos-call')
}

/**
 * named-call ::= O-PAREN (named-arg (COMMA named-arg)*)? COMMA? C-PAREN
 */
export const parseNamedCall = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-paren')
    while (parser.atAny(paramFirstTokens) && !parser.eof()) {
        parseNamedArg(parser)
        if (!parser.at('c-paren')) {
            parser.expect('comma')
        }
    }
    parser.expect('c-paren')
    parser.close(mark, 'named-call')
}

/**
 * named-arg ::= NAME COLON expr
 */
export const parseNamedArg = (parser: Parser): void => {
    const mark = parser.open()
    parser.expectAny(nameLikeTokens)
    parser.expect('colon')
    parseExpr(parser)
    parser.close(mark, 'named-arg')
}

export const parseTodo = (parser: Parser): void => {
    parser.advanceWithError(syntaxError(parser, 'todo'))
}
