import { Parser } from '../parser'
import { parseTypeDef } from './type-def'
import { exprFirstTokens, parseParams, parseTypeAnnot, useExprFirstTokens } from './index'
import { parseExpr, parseTypeExpr } from './expr'
import { parsePattern } from './match'

/**
 * statement ::= var-def | fn-def | kind-def | impl-def | type-def | return-stmt | expr
 */
export const parseStatement = (parser: Parser): void => {
    const mark = parser.open()

    if (parser.at('let-keyword')) {
        parseVarDef(parser)
    } else if (parser.at('fn-keyword')) {
        parseFnDef(parser)
    } else if (parser.at('kind-keyword')) {
        parseKindDef(parser)
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
 * fn-def ::= FN-KEYWORD type-expr O-PAREN params? C-PAREN type-annot? block?
 */
export const parseFnDef = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('fn-keyword')
    parseTypeExpr(parser)
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
 * kind-def ::= KIND-KEYWORD type-expr block
 */
export const parseKindDef = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('kind-keyword')
    parseTypeExpr(parser)
    parseBlock(parser)
    parser.close(mark, 'kind-def')
}

/**
 * impl-def ::= IMPL-KEYWORD type-expr impl-for? block
 */
export const parseImplDef = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('impl-keyword')
    parseTypeExpr(parser)
    if (parser.at('for-keyword')) {
        parseImplFor(parser)
    }
    parseBlock(parser)
    parser.close(mark, 'impl-def')
}

/**
 * impl-for ::= FOR-KEYWORD type-expr
 */
export const parseImplFor = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('for-keyword')
    parseTypeExpr(parser)
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

