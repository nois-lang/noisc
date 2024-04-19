import { Parser } from '..'
import { syntaxError } from '../../error'
import { TokenKind } from '../../lexer/lexer'
import { exprFirstTokens, infixOpFirstTokens, nameLikeTokens, numberFirstTokens, parseClosureExpr } from './index'
import { parseMatchExpr, parsePattern } from './match'
import { parseInfixOp, parsePostfixOp } from './op'
import { parseBlock } from './statement'
import { parseType } from './type'

/**
 * expr ::= sub-expr (infix-op sub-expr)*
 */
export const parseExpr = (parser: Parser): void => {
    const mark = parser.open()
    parseSubExpr(parser)
    while (parser.atAny(infixOpFirstTokens)) {
        parseInfixOp(parser)
        parseSubExpr(parser)
    }
    parser.close(mark, 'expr')
}

/**
 * sub-expr ::= operand postfix-op*
 */
export const parseSubExpr = (parser: Parser): void => {
    const mark = parser.open()
    parseOperand(parser)
    while (
        parser.at('period') ||
        parser.at('o-paren') ||
        (parser.at('excl') && parser.nth(1) !== 'equals') ||
        parser.at('qmark')
    ) {
        parsePostfixOp(parser)
    }
    parser.close(mark, 'sub-expr')
}

/**
 * operand ::= if-expr | match-expr | closure-expr | O-PAREN expr C-PAREN | list-expr | STRING | CHAR | number | TRUE
 * | FALSE | identifier | type
 */
export const parseOperand = (parser: Parser): void => {
    const dynamicTokens: TokenKind[] = ['char', 'int', 'float', 'bool']

    const mark = parser.open()
    if (parser.at('if-keyword') && parser.nth(1) === 'let-keyword') {
        parseIfLetExpr(parser)
    } else if (parser.at('if-keyword')) {
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
    } else if (parser.atAny(numberFirstTokens)) {
        parseNumber(parser)
    } else if (parser.at('d-quote')) {
        parseString(parser)
    } else if (parser.atAny(dynamicTokens)) {
        parser.expectAny(dynamicTokens)
    } else {
        parser.advanceWithError(syntaxError(parser, 'expected operand'))
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
 * if-let-expr ::= IF-KEYWORD LET-KEYWORD pattern EQUALS expr block (ELSE-KEYWORD block)?
 */
export const parseIfLetExpr = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('if-keyword')
    parser.expect('let-keyword')
    parsePattern(parser)
    parser.expect('equals')
    parseExpr(parser)
    parseBlock(parser)
    if (parser.consume('else-keyword')) {
        parseBlock(parser)
    }
    parser.close(mark, 'if-let-expr')
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
    if (
        parser.at('o-angle') &&
        parser.encounter('c-angle', [...nameLikeTokens, 'colon', 'comma', 'o-angle', 'underscore', 'pipe'])
    ) {
        parseTypeArgs(parser)
    }
    parser.close(mark, 'identifier')
}

/**
 * number ::= MINUS? (INT | FLOAT)
 */
export const parseNumber = (parser: Parser): void => {
    const mark = parser.open()
    parser.consume('minus')
    if (parser.consume('int')) {
    } else if (parser.consume('float')) {
    } else {
        parser.advanceWithError(syntaxError(parser, 'expected number'))
    }
    parser.close(mark, 'number')
}

/**
 * string ::= D-QUOTE string-part* D-QUOTE
 */
export const parseString = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('d-quote')
    while (!parser.eof() && !parser.at('d-quote')) {
        parseStringPart(parser)
    }
    parser.expect('d-quote')
    parser.close(mark, 'string')
}

/*
 * string-part ::= STRING | O-BRACE expr C-BRACE
 */
export const parseStringPart = (parser: Parser): void => {
    const mark = parser.open()
    if (parser.consume('string-part')) {
        parser.close(mark, 'string-part')
        return
    }
    parser.expect('o-brace')
    parseExpr(parser)
    parser.expect('c-brace')
    parser.close(mark, 'string-part')
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
