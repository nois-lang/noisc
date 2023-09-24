import { Parser } from '../parser'
import { parseExpr, parseIdentifier } from './expr'
import { parseBlock } from './statement'
import { fieldPatternFirstTokens, nameLikeTokens, patternFollowTokens, prefixOpFirstTokens } from './index'
import { parsePrefixOp, parseSpreadOp } from './op'

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
 * match-clauses ::= O-BRACE (match-clause (COMMA match-clause)*)? COMMA? C-BRACE
 */
export const parseMatchClauses = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-brace')
    while (!parser.at('c-brace') && !parser.eof()) {
        parseMatchClause(parser)
        if (!parser.at('c-brace')) {
            parser.expect('comma')
        }
    }
    parser.expect('c-brace')
    parser.close(mark, 'match-clauses')
}

/**
 * match-clause ::= pattern guard? block
 */
export const parseMatchClause = (parser: Parser): void => {
    const mark = parser.open()
    parsePattern(parser)
    if (parser.at('if-keyword')) {
        parseGuard(parser)
    }
    parseBlock(parser)
    parser.close(mark, 'match-clause')
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

export const parsePatternBind = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('name')
    parser.expect('at')
    parser.close(mark, 'pattern-bind')
}

export const parsePatternExpr = (parser: Parser): void => {
    const mark = parser.open()
    // tough case to decide it is a name or a con-pattern, name should be followed by pattern follow tokens
    // because COLON is a follow token, we should check if it is a part of scope resolution
    const isFollowedByScopeRes = parser.nth(1) === 'colon' && parser.nth(2) === 'colon'
    if (parser.atAny(nameLikeTokens) && patternFollowTokens.includes(parser.nth(1)) && !isFollowedByScopeRes) {
        parser.expectAny(nameLikeTokens)
    } else if (parser.atAny(nameLikeTokens)) {
        parseConPattern(parser)
    } else if (parser.consume('string')) {
    } else if (parser.consume('char')) {
    } else if (parser.atAny(prefixOpFirstTokens) || parser.at('int') || parser.at('float')) {
        if (parser.atAny(prefixOpFirstTokens)) {
            parsePrefixOp(parser)
        }
        if (parser.at('int')) {
            parser.expect('int')
        } else if (parser.at('float')) {
            parser.expect('float')
        } else {
            parser.advanceWithError('expected pattern')
        }
    } else if (parser.at('underscore')) {
        parseHole(parser)
    } else {
        parser.advanceWithError('expected pattern')
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
 * field-pattern ::= NAME (COLON pattern) | spread-op
 */
export const parseFieldPattern = (parser: Parser): void => {
    const mark = parser.open()
    if (parser.atAny(nameLikeTokens)) {
        parser.expectAny(nameLikeTokens)
        if (parser.consume('colon')) {
            parsePattern(parser)
        }
    } else if (parser.at('period')) {
        parseSpreadOp(parser)
    }
    parser.close(mark, 'field-pattern')
}

/**
 * hole ::= UNDERSCORE
 */
export const parseHole = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('underscore')
    parser.close(mark, 'hole')
}

