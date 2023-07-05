import { Parser } from '../parser'
import { TokenKind } from '../../lexer/lexer'
import {
    exprFirstTokens,
    infixOpFirstTokens,
    parseClosureExpr,
    postfixOpFirstTokens,
    prefixOpFirstTokens
} from './index'
import { parseInfixOp, parsePostfixOp, parsePrefixOp } from './op'
import { parseMatchExpr, parsePattern } from './match'
import { parseBlock } from './statement'

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
    } else if (parser.at('name')) {
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
 * identifier ::= (NAME COLON COLON)* NAME
 */
export const parseIdentifier = (parser: Parser): void => {
    const mark = parser.open()
    while (parser.nth(1) === 'colon' && parser.nth(2) === 'colon' && !parser.eof()) {
        parser.expect('name')
        parser.expect('colon')
        parser.expect('colon')
    }
    if (parser.at('name')) {
        parser.expect('name')
    } else {
        parser.advanceWithError('expected name')
    }
    parser.close(mark, 'identifier')
}
