import { syntaxError } from '../../error'
import { Parser } from '../parser'
import { parseExpr, parseIdentifier } from './expr'
import { exprFirstTokens, nameLikeTokens, paramFirstTokens, useExprFirstTokens } from './index'
import { parsePattern } from './match'
import { parseTypeAnnot, parseTypeBounds } from './type'
import { parseTypeDef } from './type-def'

/**
 * statement ::= var-def | fn-def | kind-def | impl-def | type-def | return-stmt | break-stmt | expr
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
    } else if (parser.at('break-keyword')) {
        parseBreakStmt(parser)
    } else if (parser.atAny(exprFirstTokens)) {
        parseExpr(parser)
    } else {
        parser.advanceWithError(syntaxError(parser, 'expected statement'))
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
    while (parser.atAny(nameLikeTokens) && parser.nth(1) === 'colon' && parser.nth(2) === 'colon' && !parser.eof()) {
        parser.expectAny(nameLikeTokens)
        parser.expect('colon')
        parser.expect('colon')
    }
    if (parser.at('o-brace')) {
        parseUseList(parser)
    } else if (parser.atAny(nameLikeTokens)) {
        parser.expectAny(nameLikeTokens)
    } else if (parser.at('asterisk')) {
        parseWildcard(parser)
    } else {
        parser.advanceWithError(syntaxError(parser, 'expected use-expr'))
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
    parser.expectAny(nameLikeTokens)
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
    while (parser.atAny(nameLikeTokens) && !parser.eof()) {
        parseGeneric(parser)
        if (!parser.at('c-angle')) {
            parser.expect('comma')
        }
    }
    parser.expect('c-angle')
    parser.close(mark, 'generics')
}
/**
 * generic ::= NAME (COLON type)?
 */
export const parseGeneric = (parser: Parser): void => {
    const mark = parser.open()
    parser.expectAny(nameLikeTokens)
    if (parser.at('colon')) {
        parser.expect('colon')
        parseTypeBounds(parser)
    }
    parser.close(mark, 'generic')
}

/**
 * kind-def ::= KIND-KEYWORD NAME generics? block
 */
export const parseTraitDef = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('trait-keyword')
    parser.expectAny(nameLikeTokens)
    if (parser.at('o-angle')) {
        parseGenerics(parser)
    }
    parseBlock(parser)
    parser.close(mark, 'trait-def')
}

/**
 * impl-def ::= IMPL-KEYWORD generics? identifier impl-for? block
 */
export const parseImplDef = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('impl-keyword')
    if (parser.at('o-angle')) {
        parseGenerics(parser)
    }
    parseIdentifier(parser)
    if (parser.at('for-keyword')) {
        parseImplFor(parser)
    }
    parseBlock(parser)
    parser.close(mark, 'impl-def')
}

/**
 * impl-for ::= FOR-KEYWORD identifier
 */
export const parseImplFor = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('for-keyword')
    parseIdentifier(parser)
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
 * break-stmt ::= BREAK-KEYWORD
 */
export const parseBreakStmt = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('break-keyword')
    parser.close(mark, 'break-stmt')
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

