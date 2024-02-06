import { syntaxError } from '../../error'
import { Parser } from '../parser'
import { nameLikeTokens, parseNamedCall, parsePosCall } from './index'

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
 * prefix-op ::= sub-op | not-op | spread-op
 */
export const parsePrefixOp = (parser: Parser): void => {
    const mark = parser.open()
    const m = parser.open()

    if (parser.consume('minus')) {
        parser.close(m, 'neg-op')
    } else if (parser.consume('excl')) {
        parser.close(m, 'not-op')
    } else if (parser.at('period') && parser.nth(1) === 'period') {
        parser.advance()
        parser.advance()
        parser.close(m, 'spread-op')
    } else {
        parser.advanceWithError(syntaxError(parser, 'expected prefix operator'))
        parser.close(m, 'error')
    }

    parser.close(mark, 'prefix-op')
}

export const parseSpreadOp = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('period')
    parser.expect('period')
    parser.close(mark, 'spread-op')
}

/**
 * postfix-op ::= pos-call | named-call
 */
export const parsePostfixOp = (parser: Parser): void => {
    const mark = parser.open()
    if (
        parser.at('o-paren') &&
        nameLikeTokens.includes(parser.nth(1)) &&
        parser.nth(2) === 'colon' &&
        parser.nth(3) !== 'colon'
    ) {
        parseNamedCall(parser)
    } else if (parser.at('o-paren')) {
        parsePosCall(parser)
    } else {
        parser.advanceWithError(syntaxError(parser, 'expected postfix operator'))
    }
    parser.close(mark, 'postfix-op')
}
