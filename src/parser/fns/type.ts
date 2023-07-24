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
 * type ::= identifier | fn-type
 */
export const parseType = (parser: Parser): void => {
    const mark = parser.open()
    if (parser.at('name')) {
        parseIdentifier(parser)
    } else if (parser.at('pipe')) {
        parseFnType(parser)
    } else {
        parser.advanceWithError('expected type')
    }
    parser.close(mark, 'type')
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
