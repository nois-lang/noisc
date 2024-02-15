import { nameLikeTokens } from '.'
import { Parser } from '..'
import { syntaxError } from '../../error'
import { parseExpr } from './expr'

/**
 * infix-op ::= add-op | sub-op | mult-op | div-op | exp-op | mod-op | access-op | eq-op | ne-op | ge-op | le-op | gt-op
 * | lt-op | and-op | or-op | assign-op;
 */
export const parseInfixOp = (parser: Parser): void => {
    const mark = parser.open()
    if (parser.consume('plus')) {
        parser.close(mark, 'add-op')
        return
    }
    if (parser.consume('minus')) {
        parser.close(mark, 'sub-op')
        return
    }
    if (parser.consume('asterisk')) {
        parser.close(mark, 'mult-op')
        return
    }
    if (parser.consume('slash')) {
        parser.close(mark, 'div-op')
        return
    }
    if (parser.consume('caret')) {
        parser.close(mark, 'exp-op')
        return
    }
    if (parser.consume('percent')) {
        parser.close(mark, 'mod-op')
        return
    }
    if (parser.consume('period')) {
        parser.close(mark, 'access-op')
        return
    }
    if (parser.at('equals') && parser.nth(1) === 'equals') {
        parser.advance()
        parser.advance()
        parser.close(mark, 'eq-op')
        return
    }
    if (parser.at('excl') && parser.nth(1) === 'equals') {
        parser.advance()
        parser.advance()
        parser.close(mark, 'ne-op')
        return
    }
    if (parser.consume('c-angle')) {
        if (parser.consume('equals')) {
            parser.close(mark, 'ge-op')
        } else {
            parser.close(mark, 'gt-op')
        }
        return
    }
    if (parser.consume('o-angle')) {
        if (parser.consume('equals')) {
            parser.close(mark, 'le-op')
        } else {
            parser.close(mark, 'lt-op')
        }
        return
    }
    if (parser.consume('ampersand')) {
        parser.advance()
        parser.close(mark, 'and-op')
        return
    }
    if (parser.consume('pipe')) {
        parser.advance()
        parser.close(mark, 'or-op')
        return
    }
    if (parser.consume('equals')) {
        parser.close(mark, 'assign-op')
        return
    }

    parser.advanceWithError(syntaxError(parser, 'expected infix operator'), mark)
}

/**
 * postfix-op ::= call-op | unwrap-op | bind-op
 */
export const parsePostfixOp = (parser: Parser): void => {
    if (parser.at('o-paren')) {
        parseCallOp(parser)
        return
    }
    const mark = parser.open()
    if (parser.consume('excl')) {
        parser.close(mark, 'unwrap-op')
        return
    }
    if (parser.consume('qmark')) {
        parser.close(mark, 'bind-op')
        return
    }
    parser.advanceWithError(syntaxError(parser, 'expected postfix operator'), mark)
}

/**
 * call-op ::= O-PAREN (arg (COMMA arg)*)? COMMA? C-PAREN
 */
export const parseCallOp = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-paren')
    while (!parser.at('c-paren') && !parser.eof()) {
        parseArg(parser)
        if (!parser.at('c-paren')) {
            parser.expect('comma')
        }
    }
    parser.expect('c-paren')
    parser.close(mark, 'call-op')
}

/**
 * arg ::= (NAME COLON)? expr
 */
export const parseArg = (parser: Parser): void => {
    const mark = parser.open()
    // avoid parsing qualified ids as named args
    if (parser.nth(1) === 'colon' && parser.nth(2) !== 'colon') {
        parser.expectAny(nameLikeTokens)
        parser.expect('colon')
    }
    parseExpr(parser)
    parser.close(mark, 'arg')
}
