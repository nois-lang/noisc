import { Parser } from '../parser'
import { TokenKind } from '../../lexer/lexer'
import {
    exprFirstTokens,
    infixOpFirstTokens,
    nameLikeTokens,
    parseClosureExpr,
    postfixOpFirstTokens,
    prefixOpFirstTokens
} from './index'
import { parseInfixOp, parsePostfixOp, parsePrefixOp } from './op'
import { parseMatchExpr, parsePattern } from './match'
import { parseBlock } from './statement'
import { parseType } from './type'

/**
 * expr ::= sub-expr (infix-op sub-expr)*
 */
export const parseExpr = (parser: Parser): void => {
    const mark = parser.open()
    parseSubExpr(parser)
    while (parser.atAny(infixOpFirstTokens) && !parser.eof()) {
        parseInfixOp(parser)
        if (!parser.eof()) {
            parseSubExpr(parser)
        } else {
            parser.advanceWithError('expected expression')
        }
    }
    parser.close(mark, 'expr')
}

/**
 * sub-expr ::= prefix-op operand | operand postfix-op?
 */
export const parseSubExpr = (parser: Parser): void => {
    const mark = parser.open()
    if (parser.atAny(prefixOpFirstTokens)) {
        parsePrefixOp(parser)
        parseOperand(parser)
    } else {
        parseOperand(parser)
        if (parser.atAny(postfixOpFirstTokens)) {
            parsePostfixOp(parser)
        }
    }
    parser.close(mark, 'sub-expr')
}

/**
 * operand ::= if-expr | match-expr | closure-expr | O-PAREN expr C-PAREN | list-expr | STRING | CHAR | INT | FLOAT
 * | identifier | type
 */
export const parseOperand = (parser: Parser): void => {
    const dynamicTokens: TokenKind[] = ['string', 'char', 'int', 'float']

    const mark = parser.open()
    if (parser.at('if-keyword')) {
        parseIfExpr(parser)
    } else if (parser.at('while-keyword')) {
        parseWhileExpr(parser)
    } else if (parser.at('for-keyword')) {
        parseForExpr(parser)
    } else if (parser.at('match-keyword')) {
        parseMatchExpr(parser)
    } else if (parser.at('pipe')) {
        parseClosureExpr(parser)
    } else if (parser.at('o-paren') && exprFirstTokens.includes(parser.nth(1))) {
        parser.expect('o-paren')
        parseExpr(parser)
        parser.expect('c-paren')
    } else if (parser.at('o-bracket')) {
        parseListExpr(parser)
    } else if (parser.atAny(nameLikeTokens)) {
        parseIdentifier(parser)
    } else if (parser.atAny(dynamicTokens)) {
        parser.expectAny(dynamicTokens)
    } else {
        parser.advanceWithError('expected operand')
    }

    parser.close(mark, 'operand')
}

/**
 * list-expr ::= O-BRACKET (expr (COMMA expr)*)? COMMA? C-BRACKET
 */
export const parseListExpr = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-bracket')
    while (parser.atAny(exprFirstTokens) && !parser.eof()) {
        parseExpr(parser)
        if (!parser.at('c-bracket')) {
            parser.expect('comma')
        }
    }
    parser.expect('c-bracket')
    parser.close(mark, 'list-expr')
}

/**
 * if-expr ::= IF-KEYWORD expr block (ELSE-KEYWORD block)?
 */
export const parseIfExpr = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('if-keyword')
    parseExpr(parser)
    parseBlock(parser)
    if (parser.consume('else-keyword')) {
        parseBlock(parser)
    }
    parser.close(mark, 'if-expr')
}

/**
 * while-expr ::= WHILE-KEYWORD expr block
 */
export const parseWhileExpr = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('while-keyword')
    parseExpr(parser)
    parseBlock(parser)
    parser.close(mark, 'while-expr')
}

/**
 * for-expr ::= FOR-KEYWORD pattern IN-KEYWORD expr block
 */
export const parseForExpr = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('for-keyword')
    parsePattern(parser)
    parser.expect('in-keyword')
    parseExpr(parser)
    parseBlock(parser)
    parser.close(mark, 'for-expr')
}

/**
 * identifier ::= (NAME COLON COLON)* NAME type-args?
 */
export const parseIdentifier = (parser: Parser): void => {
    const mark = parser.open()
    while (parser.atAny(nameLikeTokens) && parser.nth(1) === 'colon' && parser.nth(2) === 'colon' && !parser.eof()) {
        parser.expectAny(nameLikeTokens)
        parser.expect('colon')
        parser.expect('colon')
    }
    if (parser.atAny(nameLikeTokens)) {
        parser.expectAny(nameLikeTokens)
    }
    if (parser.at('o-angle') && parser.encounter('c-angle', [...nameLikeTokens, 'colon', 'comma', 'o-angle'])) {
        parseTypeArgs(parser)
    }
    parser.close(mark, 'identifier')
}

/**
 * type-args ::= O-ANGLE (type (COMMA type)* COMMA?)? C-ANGLE
 */
export const parseTypeArgs = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-angle')
    while (!parser.at('c-angle') && !parser.eof()) {
        parseType(parser)
        if (!parser.at('c-angle')) {
            parser.expect('comma')
        }
    }
    parser.expect('c-angle')
    parser.close(mark, 'type-args')
}
