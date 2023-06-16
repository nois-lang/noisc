import { Parser } from '../parser'
import { parseIdentifier, parseTypeExpr } from './expr'
import { paramFirstTokens, parseTypeAnnot } from './index'

/**
 * type-def ::= TYPE-KEYWORD type-expr (type-con-params? | type-con-list)
 */
export const parseTypeDef = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('type-keyword')
    parseTypeExpr(parser)
    if (parser.at('o-paren')) {
        parseTypeConParams(parser)
    } else if (parser.at('o-brace')) {
        parseTypeConList(parser)
    }
    parser.close(mark, 'type-def')
}

/**
 * type-con-params ::= O-PAREN (field-def (COMMA field-def)*)? COMMA? C-PAREN
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
    parser.close(mark, 'type-con-params')
}

/**
 * field-def ::= identifier type-annot
 */
export const parseFieldDef = (parser: Parser): void => {
    const mark = parser.open()
    parseIdentifier(parser)
    parseTypeAnnot(parser)
    parser.close(mark, 'field-def')
}

/**
 * type-con-list ::= O-BRACE (type-con (COMMA type-con)* COMMA?)? C-BRACE
 */
export const parseTypeConList = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-brace')
    while (!parser.at('c-brace') && !parser.eof()) {
        parseTypeCon(parser)
        if (!parser.at('c-brace')) {
            parser.expect('comma')
        }
    }
    parser.expect('c-brace')
    parser.close(mark, 'type-con-list')
}

/**
 * type-con ::= identifier con-params?
 */
export const parseTypeCon = (parser: Parser): void => {
    const mark = parser.open()
    parseIdentifier(parser)
    if (parser.at('o-paren')) {
        parseTypeConParams(parser)
    }
    parser.close(mark, 'type-con')
}

