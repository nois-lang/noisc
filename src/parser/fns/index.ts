import { TokenKind } from '../../lexer/lexer'
import { Parser } from '../parser'
import { parseExpr, parseIdentifier, parseTypeExpr } from './expr'
import { parseBlock, parseStatement } from './statement'
import { parsePattern } from './match'

export const prefixOpFirstTokens: TokenKind[] = ['excl', 'minus', 'period', 'plus']
export const postfixOpFirstTokens: TokenKind[] = ['o-paren']
export const infixOpFirstTokens: TokenKind[] = ['ampersand', 'asterisk', 'c-angle', 'caret', 'equals', 'excl', 'minus',
    'o-angle', 'percent', 'period', 'pipe', 'plus', 'slash']
export const exprFirstTokens: TokenKind[] = ['char', 'name', 'if-keyword', 'while-keyword', 'for-keyword',
    'match-keyword', 'int', 'float', 'o-bracket', 'o-paren', 'string', ...prefixOpFirstTokens]
export const paramFirstTokens: TokenKind[] = ['name']
export const useExprFirstTokens: TokenKind[] = ['name', 'asterisk', 'o-brace']

/**
 * module ::= statement*
 */
export const parseModule = (parser: Parser): void => {
    const mark = parser.open()
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
    parser.expect('name')
    parser.expect('colon')
    parseExpr(parser)
    parser.close(mark, 'field-init')
}

/**
 * params ::= O-PAREN (param (COMMA param)*)? COMMA? C-PAREN
 */
export const parseParams = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-paren')
    while (parser.atAny(paramFirstTokens) && !parser.eof()) {
        parseParam(parser)
        if (!parser.at('c-paren')) {
            parser.expect('comma')
        }
    }
    parser.expect('c-paren')
    parser.close(mark, 'params')
}

/**
 * param ::= IDENTIFIER type-annot?
 */
export const parseParam = (parser: Parser): void => {
    const mark = parser.open()
    parsePattern(parser)
    if (parser.at('colon')) {
        parseTypeAnnot(parser)
    }
    parser.close(mark, 'param')
}

/**
 * type-annot ::= COLON type-expr
 */
export const parseTypeAnnot = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('colon')
    parseTypeExpr(parser)
    parser.close(mark, 'type-annot')
}

/**
 * type-params ::= O-ANGLE (type-param (COMMA type-param)* COMMA?)? C-ANGLE
 */
export const parseTypeParams = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-angle')
    while (!parser.at('c-angle') && !parser.eof()) {
        parseTypeParam(parser)
        if (!parser.at('c-angle')) {
            parser.expect('comma')
        }
    }
    parser.expect('c-angle')
    parser.close(mark, 'type-params')
}

/**
 * type-param ::= type-expr | identifier COLON type-bounds
 */
export const parseTypeParam = (parser: Parser): void => {
    const mark = parser.open()
    if (parser.nth(1) === 'colon') {
        parseIdentifier(parser)
        parser.expect('colon')
        parseTypeBounds(parser)
    } else {
        parseTypeExpr(parser)
    }
    parser.close(mark, 'type-param')
}

/**
 * type-bounds ::= type-expr (PLUS type-expr)*
 */
export const parseTypeBounds = (parser: Parser): void => {
    const mark = parser.open()
    parseTypeExpr(parser)
    while (parser.at('plus') && !parser.eof()) {
        parser.expect('plus')
        parseTypeExpr(parser)
    }
    parser.close(mark, 'type-bounds')
}

export const parseTodo = (parser: Parser): void => {
    parser.advanceWithError('todo')
}
