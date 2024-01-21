import { nameLikeTokens } from '.'
import { syntaxError } from '../../error'
import { Parser } from '../parser'
import { parseIdentifier } from './expr'
import { parseHole } from './match'

/**
 * type-annot ::= COLON type
 */
export const parseTypeAnnot = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('colon')
    parseType(parser)
    parser.close(mark, 'type-annot')
}

/**
 * type ::= type-bounds | fn-type | hole
 */
export const parseType = (parser: Parser): void => {
    const mark = parser.open()
    if (parser.atAny(nameLikeTokens)) {
        parseTypeBounds(parser)
    } else if (parser.at('pipe')) {
        parseFnType(parser)
    } else if (parser.at('underscore')) {
        parseHole(parser)
    } else {
        parser.advanceWithError(syntaxError(parser, 'expected type'))
    }
    parser.close(mark, 'type')
}

/**
 * type-bounds ::= identifier (PLUS identifier)*
 */
export const parseTypeBounds = (parser: Parser): void => {
    const mark = parser.open()
    parseIdentifier(parser)
    while (parser.at('plus') && !parser.eof()) {
        parser.expect('plus')
        parseIdentifier(parser)
    }
    parser.close(mark, 'type-bounds')
}

/**
 * fn-type ::= fn-type-params type-annot
 */
export const parseFnType = (parser: Parser): void => {
    const mark = parser.open()
    parseFnTypeParams(parser)
    parseTypeAnnot(parser)
    parser.close(mark, 'fn-type')
}

/**
 * fn-type-params ::= PIPE (type-param (COMMA type)* COMMA?)? PIPE
 */
export const parseFnTypeParams = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('pipe')
    while (!parser.at('pipe') && !parser.eof()) {
        parseType(parser)
        if (!parser.at('pipe')) {
            parser.expect('comma')
        }
    }
    parser.expect('pipe')
    parser.close(mark, 'fn-type-params')
}
