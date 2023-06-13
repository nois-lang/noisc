import { TokenKind } from '../../lexer/lexer'
import { Parser } from '../parser'
import { parseExpr, parseTypeExpr } from './expr'
import { parseBlock, parseStatement } from './statement'
import { parsePattern } from './match'

export const prefixOpFirstTokens: TokenKind[] = ['excl', 'minus', 'period', 'plus']
export const postfixOpFirstTokens: TokenKind[] = ['o-paren']
export const infixOpFirstTokens: TokenKind[] = ['ampersand', 'asterisk', 'c-angle', 'caret', 'equals', 'excl', 'minus',
    'o-angle', 'percent', 'period', 'pipe', 'plus', 'slash']
export const exprFirstTokens: TokenKind[] = ['char', 'identifier', 'if-keyword', 'while-keyword', 'for-keyword',
    'match-keyword', 'int', 'float', 'o-bracket', 'o-paren', 'string', ...prefixOpFirstTokens]
export const paramFirstTokens: TokenKind[] = ['identifier']

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
 * lambda-expr ::= lambda-params type-annot? (block | expr)
 */
export const parseLambdaExpr = (parser: Parser): void => {
    const mark = parser.open()
    parseLambdaParams(parser)
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
    parser.close(mark, 'lambda-expr')
}

/**
 * lambda-params ::= PIPE (param (COMMA param)*)? COMMA? PIPE
 */
export const parseLambdaParams = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('pipe')
    while (!parser.at('pipe') && !parser.eof()) {
        parseParam(parser)
        if (!parser.at('pipe')) {
            parser.expect('comma')
        }
    }
    parser.expect('pipe')
    parser.close(mark, 'lambda-params')
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
    parser.close(mark, 'con-params')
}

/**
 * field-init ::= IDENTIFIER COLON expr
 */
export const parseFieldInit = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('identifier')
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
 * type-params ::= O-ANGLE (type-expr (COMMA type-expr)* COMMA?)? C-ANGLE
 */
export const parseTypeParams = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-angle')
    while (!parser.at('c-angle') && !parser.eof()) {
        parseTypeExpr(parser)
        if (!parser.at('c-angle')) {
            parser.expect('comma')
        }
    }
    parser.expect('c-angle')
    parser.close(mark, 'params')
}

export const parseTodo = (parser: Parser): void => {
    parser.advanceWithError('todo')
}
