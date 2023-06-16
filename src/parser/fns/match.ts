import { Parser } from '../parser'
import { parseExpr, parseIdentifier } from './expr'
import { parseBlock } from './statement'
import { prefixOpFirstTokens } from './index'
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
 * match-clause ::= pattern guard? ARROW (block | expr)
 */
export const parseMatchClause = (parser: Parser): void => {
    const mark = parser.open()
    parsePattern(parser)
    if (parser.at('if-keyword')) {
        parseGuard(parser)
    }
    parser.expect('arrow')
    if (parser.at('o-brace')) {
        parseBlock(parser)
    } else {
        parseExpr(parser)
    }
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
 * pattern ::= con-pattern | STRING | CHAR | prefix-op? (INT | FLOAT) | identifier | hole
 */
export const parsePattern = (parser: Parser): void => {
    const mark = parser.open()
    if (parser.at('name') && parser.nth(1) === 'o-paren') {
        parseConPattern(parser)
    } else if (parser.consume('string')) {
    } else if (parser.consume('char')) {
    } else if (parser.atAny(prefixOpFirstTokens) || parser.at('int') || parser.at('float')) {
        if (parser.atAny(prefixOpFirstTokens)) {
            parsePrefixOp(parser)
        }
        if (parser.consume('int')) {
        } else if (parser.consume('float')) {
        }
    } else if (parser.at('name')) {
        parseIdentifier(parser)
    } else if (parser.at('underscore')) {
        parseHole(parser)
    } else {
        parser.advanceWithError('expected pattern')
    }
    parser.close(mark, 'pattern')
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
    while (!parser.at('c-paren') && !parser.eof()) {
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
    if (parser.at('name')) {
        parser.expect('name')
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

