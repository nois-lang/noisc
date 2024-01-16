import { Parser } from '../parser'
import { nameLikeTokens, paramFirstTokens } from './index'
import { parseGenerics } from './statement'
import { parseTypeAnnot } from './type'

/**
 * type-def ::= TYPE-KEYWORD NAME generics? (variant-list | variant-params)?
 */
export const parseTypeDef = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('type-keyword')
    parser.expectAny(nameLikeTokens)
    if (parser.at('o-angle')) {
        parseGenerics(parser)
    }
    if (parser.at('o-paren')) {
        parseTypeConParams(parser)
    } else if (parser.at('o-brace')) {
        parseTypeConList(parser)
    }
    parser.close(mark, 'type-def')
}

/**
 * variant-params ::= O-PAREN (field-def (COMMA field-def)*)? COMMA? C-PAREN
 */
export const parseTypeConParams = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-paren')
    while (parser.atAny(paramFirstTokens) && !parser.eof()) {
        parseFieldDef(parser)
        if (!parser.at('c-paren')) {
            parser.expect('comma')
        }
    }
    parser.expect('c-paren')
    parser.close(mark, 'variant-params')
}

/**
 * field-def ::= NAME type-annot
 */
export const parseFieldDef = (parser: Parser): void => {
    const mark = parser.open()
    parser.expectAny(nameLikeTokens)
    parseTypeAnnot(parser)
    parser.close(mark, 'field-def')
}

/**
 * variant-list ::= O-BRACE (variant (COMMA variant)* COMMA?)? C-BRACE
 */
export const parseTypeConList = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-brace')
    while (parser.atAny(nameLikeTokens) && !parser.eof()) {
        parseTypeCon(parser)
        if (!parser.at('c-brace')) {
            parser.expect('comma')
        }
    }
    parser.expect('c-brace')
    parser.close(mark, 'variant-list')
}

/**
 * variant ::= NAME variant-params?
 */
export const parseTypeCon = (parser: Parser): void => {
    const mark = parser.open()
    parser.expectAny(nameLikeTokens)
    if (parser.at('o-paren')) {
        parseTypeConParams(parser)
    }
    parser.close(mark, 'variant')
}
