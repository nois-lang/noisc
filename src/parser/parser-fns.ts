import { TokenKind } from '../lexer/lexer'
import { Parser } from './parser'

const prefixOpFirstTokens: TokenKind[] = ['excl', 'minus', 'period', 'plus']
const postfixOpFirstTokens: TokenKind[] = ['o-paren']
const infixOpFirstTokens: TokenKind[] = ['ampersand', 'asterisk', 'c-angle', 'caret', 'equals', 'excl', 'minus',
    'o-angle', 'percent', 'period', 'pipe', 'plus', 'slash']
const exprFirstTokens: TokenKind[] = ['char', 'identifier', 'if-keyword', 'int', 'float', 'o-paren',
    'string', ...prefixOpFirstTokens]
const statementFirstTokens: TokenKind[] = ['let-keyword', 'fn-keyword', 'kind-keyword', 'impl-keyword', 'type-keyword',
    'return-keyword', 'type-keyword', ...exprFirstTokens]
const paramFirstTokens: TokenKind[] = ['identifier']

/**
 * module ::= statement*
 */
export const parseModule = (parser: Parser): void => {
    const mark = parser.open()
    while (!parser.eof()) {
        if (parser.atAny(statementFirstTokens)) {
            parseStatement(parser)
        } else {
            parser.advanceWithError('expected statement')
        }
    }
    parser.close(mark, 'module')
}

/**
 * statement ::= var-def | fn-def | kind-def | impl-def | type-def | return-stmt | expr
 */
const parseStatement = (parser: Parser): void => {
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
 * var-def ::= LET-KEYWORD pattern type-annot? EQUALS expr
 */
const parseVarDef = (parser: Parser): void => {
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
 * fn-def ::= FN-KEYWORD type-expr O-PAREN params? C-PAREN type-annot? block?
 */
const parseFnDef = (parser: Parser): void => {
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
const parseKindDef = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('kind-keyword')
    parseTypeExpr(parser)
    parseBlock(parser)
    parser.close(mark, 'kind-def')
}

/**
 * impl-def ::= IMPL-KEYWORD type-expr impl-for? block
 */
const parseImplDef = (parser: Parser): void => {
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
const parseImplFor = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('for-keyword')
    parseTypeExpr(parser)
    parser.close(mark, 'impl-for')
}

/**
 * type-def ::= TYPE-KEYWORD type-expr (type-con-params? | type-con-list)
 */
const parseTypeDef = (parser: Parser): void => {
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
const parseTypeConParams = (parser: Parser): void => {
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
 * field-def ::= IDENTIFIER type-annot
 */
const parseFieldDef = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('identifier')
    parseTypeAnnot(parser)
    parser.close(mark, 'field-def')
}

/**
 * type-con-list ::= O-BRACE (type-con (COMMA type-con)* COMMA?)? C-BRACE
 */
const parseTypeConList = (parser: Parser): void => {
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
 * type-con ::= IDENTIFIER con-params?
 */
const parseTypeCon = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('identifier')
    if (parser.at('o-paren')) {
        parseTypeConParams(parser)
    }
    parser.close(mark, 'type-con')
}

/**
 * return-stmt ::= RETURN-KEYWORD expr?
 */
const parseReturnStmt = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('return-keyword')
    // TODO: improve with newline
    if (!parser.at('c-brace')) {
        parseExpr(parser)
    }
    parser.close(mark, 'return-stmt')
}

/**
 * expr ::= sub-expr (infix-op sub-expr)*
 */
const parseExpr = (parser: Parser): void => {
    const mark = parser.open()
    parseSubExpr(parser)
    while (parser.atAny(infixOpFirstTokens) && !parser.eof()) {
        parseInfixOp(parser)
        parseSubExpr(parser)
    }
    parser.close(mark, 'expr')
}

/**
 * sub-expr ::= prefix-op operand | operand postfix-op?
 */
const parseSubExpr = (parser: Parser): void => {
    const mark = parser.open()
    if (parser.atAny(prefixOpFirstTokens)) {
        parsePrefixOp(parser)
        parseOperand(parser)
    } else {
        parseOperand(parser)
        if (parser.atAny(postfixOpFirstTokens)) {
            parsePostfixOp(parser)
        }
    }
    parser.close(mark, 'sub-expr')
}

/**
 * operand ::= if-expr | lambda-expr | O-PAREN expr C-PAREN | list-expr | STRING | CHAR | NUMBER | IDENTIFIER | type-expr
 */
const parseOperand = (parser: Parser): void => {
    const dynamicTokens: TokenKind[] = ['string', 'char', 'int', 'float', 'identifier']

    const mark = parser.open()
    if (parser.at('if-keyword')) {
        parseIfExpr(parser)
    } else if (parser.at('pipe')) {
        parseLambdaExpr(parser)
    } else if (parser.at('o-paren')) {
        parser.expect('o-paren')
        parseExpr(parser)
        parser.expect('c-paren')
    } else if (parser.at('o-bracket')) {
        parseListExpr(parser)
    } else if (parser.at('identifier') && parser.nth(1) === 'o-angle') {
        parseTypeExpr(parser)
    } else if (parser.atAny(dynamicTokens)) {
        parser.expectAny(dynamicTokens)
    } else {
        parser.advanceWithError('expected operand')
    }

    parser.close(mark, 'operand')
}

/**
 * list-expr ::= O-BRACKET (expr (COMMA expr)*)? COMMA? C-BRACKET
 */
const parseListExpr = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-bracket')
    while (parser.atAny(exprFirstTokens) && !parser.eof()) {
        parseExpr(parser)
        if (!parser.at('c-bracket')) {
            parser.expect('comma')
        }
    }
    parser.expect('c-bracket')
    parser.close(mark, 'list-expr')
}

/**
 * infix-op ::= add-op | sub-op | mul-op | div-op | exp-op | mod-op | access-op | eq-op | ne-op | ge-op | le-op | gt-op
 * | lt-op | and-op | or-op;
 */
const parseInfixOp = (parser: Parser): void => {
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
        parser.close(mark, 'mul-op')
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
    if (parser.nth(0) === 'equals' && parser.nth(1) === 'equals') {
        parser.advance()
        parser.close(mark, 'eq-op')
        return
    }
    if (parser.consume('excl')) {
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

    parser.advanceWithError('expected infix operator')
}

/**
 * prefix-op ::= add-op | sub-op | not-op | spread-op
 */
const parsePrefixOp = (parser: Parser): void => {
    const mark = parser.open()
    const m = parser.open()

    if (parser.consume('plus')) {
        parser.close(m, 'add-op')
    } else if (parser.consume('minus')) {
        parser.close(m, 'sub-op')
    } else if (parser.consume('excl')) {
        parser.close(m, 'not-op')
    } else if (parser.at('period') && parser.nth(1) === 'period') {
        parser.advance()
        parser.advance()
        parser.close(m, 'spread-op')
    } else {
        parser.advanceWithError('expected prefix operator')
        parser.close(m, 'error')
    }

    parser.close(mark, 'prefix-op')
}

const parseSpreadOp = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('period')
    parser.expect('period')
    parser.close(mark, 'spread-op')
}

/**
 * postfix-op ::= call-op
 */
const parsePostfixOp = (parser: Parser): void => {
    const mark = parser.open()
    if (parser.at('o-paren') && parser.nth(1) === 'identifier' && parser.nth(2) === 'colon') {
        parseConOp(parser)
    } else if (parser.at('o-paren')) {
        parseCallOp(parser)
    } else {
        parser.advanceWithError('expected postfix operator')
    }
    parser.close(mark, 'postfix-op')
}

/**
 * call-op ::= args
 */
const parseCallOp = (parser: Parser): void => {
    const mark = parser.open()
    if (parser.at('o-paren')) {
        parseArgs(parser)
    } else {
        parser.advanceWithError('expected call operator')
    }
    parser.close(mark, 'call-op')
}

/**
 * args ::= O-PAREN (expr (COMMA expr)*)? COMMA? C-PAREN
 */
const parseArgs = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-paren')
    while (!parser.at('c-paren') && !parser.eof()) {
        parseExpr(parser)
        if (!parser.at('c-paren')) {
            parser.expect('comma')
        }
    }
    parser.expect('c-paren')
    parser.close(mark, 'args')
}

/**
 * lambda-expr ::= lambda-params type-annot? (block | expr)
 */
const parseLambdaExpr = (parser: Parser): void => {
    const mark = parser.open()
    parseLambdaParams(parser)
    if (parser.at('colon')) {
        parseTypeAnnot(parser)
    }
    if (parser.at('o-brace')) {
        parseBlock(parser)
    } else if (parser.atAny(exprFirstTokens)) {
        parseExpr(parser)
    } else {
        parser.advanceWithError('block or expression expected')
    }
    parser.close(mark, 'lambda-expr')
}

/**
 * lambda-params ::= PIPE (param (COMMA param)*)? COMMA? PIPE
 */
const parseLambdaParams = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('pipe')
    while (!parser.at('pipe') && !parser.eof()) {
        parseParam(parser)
        if (!parser.at('pipe')) {
            parser.expect('comma')
        }
    }
    parser.expect('pipe')
    parser.close(mark, 'lambda-params')
}

/**
 * con-op ::= O-PAREN (field-init (COMMA field-init)*)? COMMA? C-PAREN
 */
const parseConOp = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-paren')
    while (parser.atAny(paramFirstTokens) && !parser.eof()) {
        parseFieldInit(parser)
        if (!parser.at('c-paren')) {
            parser.expect('comma')
        }
    }
    parser.expect('c-paren')
    parser.close(mark, 'con-params')
}

/**
 * field-init ::= IDENTIFIER COLON expr
 */
const parseFieldInit = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('identifier')
    parser.expect('colon')
    parseExpr(parser)
    parser.close(mark, 'field-init')
}

/**
 * params ::= O-PAREN (param (COMMA param)*)? COMMA? C-PAREN
 */
const parseParams = (parser: Parser): void => {
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
const parseParam = (parser: Parser): void => {
    const mark = parser.open()
    parsePattern(parser)
    if (parser.at('colon')) {
        parseTypeAnnot(parser)
    }
    parser.close(mark, 'param')
}

/**
 * block ::= O-BRACE statement* C-BRACE
 */
const parseBlock = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-brace')
    while (!parser.at('c-brace') && !parser.eof()) {
        if (parser.atAny(statementFirstTokens)) {
            parseStatement(parser)
        } else {
            parser.advanceWithError('expected statement or `}`')
        }
    }
    parser.expect('c-brace')
    parser.close(mark, 'block')
}

/**
 * type-annot ::= COLON type-expr
 */
const parseTypeAnnot = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('colon')
    parseTypeExpr(parser)
    parser.close(mark, 'type-annot')
}

/**
 * type-expr ::= IDENTIFIER type-params?
 */
const parseTypeExpr = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('identifier')
    if (parser.at('o-angle')) {
        parseTypeParams(parser)
    }
    parser.close(mark, 'type-expr')
}

/**
 * type-params ::= O-ANGLE (type-expr (COMMA type-expr)* COMMA?)? C-ANGLE
 */
const parseTypeParams = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-angle')
    while (!parser.at('c-angle') && !parser.eof()) {
        parseTypeExpr(parser)
        if (!parser.at('c-angle')) {
            parser.expect('comma')
        }
    }
    parser.expect('c-angle')
    parser.close(mark, 'params')
}

/**
 * if-expr ::= IF-KEYWORD expr block (ELSE-KEYWORD block)?
 */
const parseIfExpr = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('if-keyword')
    parseExpr(parser)
    parseBlock(parser)
    if (parser.consume('else-keyword')) {
        parseBlock(parser)
    }
    parser.close(mark, 'if-expr')
}

/**
 * pattern ::= con-pattern | IDENTIFIER | hole
 */
const parsePattern = (parser: Parser): void => {
    const mark = parser.open()
    if (parser.at('identifier') && parser.nth(1) === 'o-paren') {
        parseConPattern(parser)
    } else if (parser.at('identifier')) {
        parser.expect('identifier')
    } else if (parser.at('underscore')) {
        parseHole(parser)
    } else {
        parser.advanceWithError('expected pattern')
    }
    parser.close(mark, 'pattern')
}

/**
 * con-pattern ::= IDENTIFIER con-pattern-params
 */
const parseConPattern = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('identifier')
    parseConPatternParams(parser)
    parser.close(mark, 'con-pattern')
}

/**
 * con-pattern-params::= O-PAREN (field-pattern (COMMA field-pattern)*)? COMMA? C-PAREN
 */
const parseConPatternParams = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-paren')
    while (!parser.at('c-paren') && !parser.eof()) {
        parseFieldPattern(parser)
        if (!parser.at('c-paren')) {
            parser.expect('comma')
        }
    }
    parser.expect('c-paren')
    parser.close(mark, 'con-pattern-params')
}

/**
 * field-pattern ::= IDENTIFIER (COLON pattern) | spread-op
 */
const parseFieldPattern = (parser: Parser): void => {
    const mark = parser.open()
    if (parser.at('identifier')) {
        parser.expect('identifier')
        if (parser.consume('colon')) {
            parsePattern(parser)
        }
    } else if (parser.at('period')) {
        parseSpreadOp(parser)
    }
    parser.close(mark, 'field-pattern')
}

/**
 * hole ::= UNDERSCORE
 */
const parseHole = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('underscore')
    parser.close(mark, 'hole')
}

const parseTodo = (parser: Parser): void => {
    parser.advanceWithError('todo')
}
