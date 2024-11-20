import { nameLikeTokens } from '.'
import { Parser } from '..'
import { syntaxError } from '../../error'
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
 * type ::= identifier | fn-type | hole
 */
export const parseType = (parser: Parser): void => {
    const mark = parser.open()
    if (parser.at('fn-keyword')) {
        parseFnType(parser)
    } else if (parser.at('underscore')) {
        parseHole(parser)
    } else if (parser.atAny(nameLikeTokens)) {
        parseIdentifier(parser)
    } else {
        parser.advanceWithError(syntaxError(parser, 'expected type'))
    }
    parser.close(mark, 'type')
}

/**
 * type-params ::= O-ANGLE (type-param (COMMA type-param)* COMMA?)? C-ANGLE
 */
export const parseTypeParams = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-angle')
    while (parser.atAny(nameLikeTokens) && !parser.eof()) {
        parseTypeParam(parser)
        if (!parser.at('c-angle')) {
            parser.expect('comma')
        }
    }
    parser.expect('c-angle')
    parser.close(mark, 'type-params')
}
/**
 * type-param ::= NAME (COLON type-bounds)?
 */
export const parseTypeParam = (parser: Parser): void => {
    const mark = parser.open()
    parser.expectAny(nameLikeTokens)
    if (parser.at('colon')) {
        parser.expect('colon')
        parseTypeBounds(parser)
    }
    parser.close(mark, 'type-param')
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
 * fn-type ::= FN-KEYWORD type-params? fn-type-params type-annot
 */
export const parseFnType = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('fn-keyword')
    if (parser.at('o-angle')) {
        parseTypeParams(parser)
    }
    parseFnTypeParams(parser)
    parseTypeAnnot(parser)
    parser.close(mark, 'fn-type')
}

/**
 * fn-type-params ::= O-BRACE (param-type (COMMA param-type)* COMMA?)? C-BRACE
 */
export const parseFnTypeParams = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-paren')
    while (!parser.at('c-paren') && !parser.eof()) {
        parseParamType(parser)
        if (!parser.at('c-paren')) {
            parser.expect('comma')
        }
    }
    parser.expect('c-paren')
    parser.close(mark, 'fn-type-params')
}

/**
 * param-type ::=NAME COLON type
 */
export const parseParamType = (parser: Parser): void => {
    const mark = parser.open()
    parser.expectAny(nameLikeTokens)
    parser.expect('colon')
    parseType(parser)
    parser.close(mark, 'param-type')
}
