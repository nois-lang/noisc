import { Parser } from '../parser'
import { parseIdentifier } from './expr'

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
 * type ::= variant-type | fn-type
 */
export const parseType = (parser: Parser): void => {
    const mark = parser.open()
    if (parser.at('name')) {
        parseVariantType(parser)
    } else {
        parseFnType(parser)
    }
    parser.close(mark, 'type')
}

/**
 * variant-type ::= identifier type-params?
 */
export const parseVariantType = (parser: Parser): void => {
    const mark = parser.open()
    parseIdentifier(parser)
    if (parser.at('o-angle')) {
        parseTypeParams(parser)
    }
    parser.close(mark, 'variant-type')
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

/**
 * type-params ::= O-ANGLE (type-param (COMMA type-param)* COMMA?)? C-ANGLE
 */
export const parseTypeParams = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-angle')
    while (!parser.at('c-angle') && !parser.eof()) {
        parseTypeParam(parser)
        if (!parser.at('c-angle')) {
            parser.expect('comma')
        }
    }
    parser.expect('c-angle')
    parser.close(mark, 'type-params')
}

/**
 * type-param ::= type | identifier COLON type-bounds
 */
export const parseTypeParam = (parser: Parser): void => {
    const mark = parser.open()
    if (parser.nth(1) === 'colon') {
        parseIdentifier(parser)
        parser.expect('colon')
        parseTypeBounds(parser)
    } else {
        parseType(parser)
    }
    parser.close(mark, 'type-param')
}

/**
 * type-bounds ::= type (PLUS type)*
 */
export const parseTypeBounds = (parser: Parser): void => {
    const mark = parser.open()
    parseType(parser)
    while (parser.at('plus') && !parser.eof()) {
        parser.expect('plus')
        parseType(parser)
    }
    parser.close(mark, 'type-bounds')
}

