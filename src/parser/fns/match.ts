import { Parser } from '..'
import { syntaxError } from '../../error'
import { parseExpr, parseIdentifier, parseNumber, parseString } from './expr'
import { fieldPatternFirstTokens, nameLikeTokens, numberFirstTokens } from './index'
import { parseBlock } from './statement'

/**
 * match-expr ::= MATCH-KEYWORD expr match-clauses
 */
export const parseMatchExpr = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('match-keyword')
    parseExpr(parser)
    parseMatchClauses(parser)
    parser.close(mark, 'match-expr')
}

/**
 * match-clauses ::= O-BRACE match-clause* C-BRACE
 */
export const parseMatchClauses = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-brace')
    while (!parser.at('c-brace') && !parser.eof()) {
        parseMatchClause(parser)
    }
    parser.expect('c-brace')
    parser.close(mark, 'match-clauses')
}

/**
 * match-clause ::= patterns guard? block
 */
export const parseMatchClause = (parser: Parser): void => {
    const mark = parser.open()
    parsePatterns(parser)
    if (parser.at('if-keyword')) {
        parseGuard(parser)
    }
    parseBlock(parser)
    parser.close(mark, 'match-clause')
}

/**
 * patterns ::= pattern (PIPE pattern)*
 */
export const parsePatterns = (parser: Parser): void => {
    const mark = parser.open()
    parsePattern(parser)
    while (parser.at('pipe')) {
        parser.expect('pipe')
        parsePattern(parser)
    }
    parser.close(mark, 'patterns')
}

/**
 * pattern ::= pattern-bind? pattern-expr
 */
export const parsePattern = (parser: Parser): void => {
    const mark = parser.open()
    if (parser.at('name') && parser.nth(1) === 'at') {
        parsePatternBind(parser)
    }
    parsePatternExpr(parser)
    parser.close(mark, 'pattern')
}

/**
 * pattern-bind ::= NAME AT
 */
export const parsePatternBind = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('name')
    parser.expect('at')
    parser.close(mark, 'pattern-bind')
}

/**
 * pattern-expr ::= STRING | CHAR | number | bool | hole | NAME | con-pattern | list-pattern
 */
export const parsePatternExpr = (parser: Parser): void => {
    const mark = parser.open()
    const isCon = (parser.nth(1) === 'colon' && parser.nth(2) === 'colon') || parser.nth(1) === 'o-paren'
    if (parser.atAny(nameLikeTokens) && isCon) {
        parseConPattern(parser)
    } else if (parser.at('o-bracket')) {
        parseListPattern(parser)
    } else if (parser.atAny(nameLikeTokens)) {
        parser.expectAny(nameLikeTokens)
    } else if (parser.at('d-quote')) {
        parseString(parser)
    } else if (parser.consume('char')) {
    } else if (parser.consume('bool')) {
    } else if (parser.atAny(numberFirstTokens)) {
        parseNumber(parser)
    } else if (parser.at('underscore')) {
        parseHole(parser)
    } else {
        parser.advanceWithError(syntaxError(parser, 'expected pattern'))
    }
    parser.close(mark, 'pattern-expr')
}

/**
 * con-pattern ::= identifier con-pattern-params
 */
export const parseConPattern = (parser: Parser): void => {
    const mark = parser.open()
    parseIdentifier(parser)
    parseConPatternParams(parser)
    parser.close(mark, 'con-pattern')
}

/**
 * list-pattern ::= O-BRACKET (pattern (COMMA pattern)*)? COMMA? C-BRACKET
 */
export const parseListPattern = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-bracket')
    while (!parser.eof() && !parser.at('c-bracket')) {
        parsePattern(parser)
        if (!parser.at('c-bracket')) {
            parser.expect('comma')
        }
    }
    parser.expect('c-bracket')
    parser.close(mark, 'list-pattern')
}

/**
 * con-pattern-params::= O-PAREN (field-pattern (COMMA field-pattern)*)? COMMA? C-PAREN
 */
export const parseConPatternParams = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-paren')
    while (parser.atAny(fieldPatternFirstTokens) && !parser.eof()) {
        parseFieldPattern(parser)
        if (!parser.at('c-paren')) {
            parser.expect('comma')
        }
    }
    parser.expect('c-paren')
    parser.close(mark, 'con-pattern-params')
}

/**
 * field-pattern ::= NAME (COLON pattern)?
 */
export const parseFieldPattern = (parser: Parser): void => {
    const mark = parser.open()
    parser.expectAny(nameLikeTokens)
    if (parser.consume('colon')) {
        parsePattern(parser)
    }
    parser.close(mark, 'field-pattern')
}

/**
 * guard ::= IF-KEYWORD expr
 */
export const parseGuard = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('if-keyword')
    parseExpr(parser)
    parser.close(mark, 'guard')
}

/**
 * hole ::= UNDERSCORE
 */
export const parseHole = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('underscore')
    parser.close(mark, 'hole')
}
