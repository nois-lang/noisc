import { Parser } from '../parser'
import { parseTypeDef } from './type-def'
import { parseExpr } from './expr'
import { parsePattern } from './match'
import { exprFirstTokens, paramFirstTokens, useExprFirstTokens } from './index'
import { parseType, parseTypeAnnot, parseVariantType } from './type'

/**
 * statement ::= var-def | fn-def | kind-def | impl-def | type-def | return-stmt | expr
 */
export const parseStatement = (parser: Parser): void => {
    const mark = parser.open()

    if (parser.at('let-keyword')) {
        parseVarDef(parser)
    } else if (parser.at('fn-keyword')) {
        parseFnDef(parser)
    } else if (parser.at('trait-keyword')) {
        parseTraitDef(parser)
    } else if (parser.at('impl-keyword')) {
        parseImplDef(parser)
    } else if (parser.at('type-keyword')) {
        parseTypeDef(parser)
    } else if (parser.at('return-keyword')) {
        parseReturnStmt(parser)
    } else if (parser.atAny(exprFirstTokens)) {
        parseExpr(parser)
    } else {
        parser.advanceWithError('expected statement')
    }

    parser.close(mark, 'statement')
}

/**
 * use-stmt ::= USE-KEYWORD use-expr
 */
export const parseUseStmt = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('use-keyword')
    parseUseExpr(parser)
    parser.close(mark, 'use-stmt')
}

/**
 * use-expr ::= (NAME COLON COLON)* (use-list | NAME | ASTERISK)
 */
export const parseUseExpr = (parser: Parser): void => {
    const mark = parser.open()
    while (parser.at('name') && parser.nth(1) === 'colon' && parser.nth(2) === 'colon' && !parser.eof()) {
        parser.expect('name')
        parser.expect('colon')
        parser.expect('colon')
    }
    if (parser.at('o-brace')) {
        parseUseList(parser)
    } else if (parser.consume('name')) {
    } else if (parser.at('asterisk')) {
        parseWildcard(parser)
    } else {
        parser.advanceWithError('expected use-expr')
    }
    parser.close(mark, 'use-expr')
}

/**
 * use-list ::= O-BRACE (use-expr (COMMA use-expr)*)? COMMA? C-BRACE
 */
export const parseUseList = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-brace')
    while (parser.atAny(useExprFirstTokens) && !parser.eof()) {
        parseUseExpr(parser)
        if (!parser.at('c-brace')) {
            parser.expect('comma')
        }
    }
    parser.expect('c-brace')
    parser.close(mark, 'use-list')
}

/**
 * use-list ::= O-BRACE (use-expr (COMMA use-expr)*)? COMMA? C-BRACE
 */
export const parseVarDef = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('let-keyword')
    parsePattern(parser)
    if (parser.at('colon')) {
        parseTypeAnnot(parser)
    }
    parser.expect('equals')
    parseExpr(parser)
    parser.close(mark, 'var-def')
}

/**
 * wildcard ::= ASTERISK
 */
export const parseWildcard = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('asterisk')
    parser.close(mark, 'wildcard')
}

/**
 * fn-def ::= FN-KEYWORD NAME generic-list? params type-annot? block?
 */
export const parseFnDef = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('fn-keyword')
    parser.expect('name')
    if (parser.at('o-angle')) {
        parseGenerics(parser)
    }
    if (parser.at('o-paren')) {
        parseParams(parser)
    }
    if (parser.at('colon')) {
        parseTypeAnnot(parser)
    }
    if (parser.at('o-brace')) {
        parseBlock(parser)
    }
    parser.close(mark, 'fn-def')
}

/**
 * params ::= O-PAREN (param (COMMA param)*)? COMMA? C-PAREN
 */
export const parseParams = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-paren')
    while (parser.atAny(paramFirstTokens) && !parser.eof()) {
        parseParam(parser)
        if (!parser.at('c-paren')) {
            parser.expect('comma')
        }
    }
    parser.expect('c-paren')
    parser.close(mark, 'params')
}

/**
 * param ::= IDENTIFIER type-annot?
 */
export const parseParam = (parser: Parser): void => {
    const mark = parser.open()
    parsePattern(parser)
    if (parser.at('colon')) {
        parseTypeAnnot(parser)
    }
    parser.close(mark, 'param')
}

/**
 * generics ::= O-ANGLE (generic (COMMA generic)* COMMA?)? C-ANGLE
 */
export const parseGenerics = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-angle')
    while (parser.at('name') && !parser.eof()) {
        parseGeneric(parser)
        if (!parser.at('c-angle')) {
            parser.expect('comma')
        }
    }
    parser.expect('c-angle')
    parser.close(mark, 'generics')
}
/**
 * generic ::= NAME (COLON generic-bounds)?
 */
export const parseGeneric = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('name')
    if (parser.at('colon')) {
        parser.expect('colon')
        parseGenericBounds(parser)
    }
    parser.close(mark, 'generic')
}

/**
 * generic-bounds ::= type (PLUS type)*
 */
export const parseGenericBounds = (parser: Parser): void => {
    const mark = parser.open()
    parseType(parser)
    while (parser.at('plus') && !parser.eof()) {
        parser.expect('plus')
        parseType(parser)
    }
    parser.close(mark, 'generic-bounds')
}

/**
 * kind-def ::= KIND-KEYWORD NAME generics? block
 */
export const parseTraitDef = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('trait-keyword')
    parser.expect('name')
    if (parser.at('o-angle')) {
        parseGenerics(parser)
    }
    parseBlock(parser)
    parser.close(mark, 'trait-def')
}

/**
 * impl-def ::= IMPL-KEYWORD NAME generics? impl-for? block
 */
export const parseImplDef = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('impl-keyword')
    parser.expect('name')
    if (parser.at('o-angle')) {
        parseGenerics(parser)
    }
    if (parser.at('for-keyword')) {
        parseImplFor(parser)
    }
    parseBlock(parser)
    parser.close(mark, 'impl-def')
}

/**
 * impl-for ::= FOR-KEYWORD variant-type
 */
export const parseImplFor = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('for-keyword')
    parseVariantType(parser)
    parser.close(mark, 'impl-for')
}

/**
 * return-stmt ::= RETURN-KEYWORD expr?
 */
export const parseReturnStmt = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('return-keyword')
    // TODO: improve with newline
    if (!parser.at('c-brace')) {
        parseExpr(parser)
    }
    parser.close(mark, 'return-stmt')
}

/**
 * block ::= O-BRACE statement* C-BRACE
 */
export const parseBlock = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-brace')
    while (!parser.at('c-brace') && !parser.eof()) {
        parseStatement(parser)
    }
    parser.expect('c-brace')
    parser.close(mark, 'block')
}

