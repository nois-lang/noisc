import { independentTokenKinds, ParseToken, TokenKind } from '../lexer/lexer'
import { SyntaxError } from '../error'

export const treeKinds = <const>[
    'error',
    'module',
    'statement',
    'var-def',
    'fn-def',
    'kind-def',
    'impl-def',
    'impl-for',
    'type-def',
    'type-con-params',
    'field-def',
    'type-con-list',
    'type-con',
    'return-stmt',
    'expr',
    'sub-expr',
    'operand',
    'infix-op',
    'add-op',
    'sub-op',
    'mul-op',
    'div-op',
    'exp-op',
    'mod-op',
    'access-op',
    'eq-op',
    'ne-op',
    'ge-op',
    'le-op',
    'gt-op',
    'lt-op',
    'and-op',
    'or-op',
    'prefix-op',
    'not-op',
    'spread-op',
    'postfix-op',
    'call-op',
    'args',
    'lambda-expr',
    'lambda-params',
    'params',
    'param',
    'block',
    'type-annot',
    'type-expr',
    'type-params',
    'if-expr',
]
export type TreeKind = typeof treeKinds[number]

export type NodeKind = TokenKind | TreeKind

export interface ParseTree {
    kind: TreeKind,
    nodes: ParseNode[]
}

export type ParseNode = ParseToken | ParseTree

export type ParseEvent = OpenEvent | { type: 'close' } | { type: 'advance' }

export interface OpenEvent {
    type: 'open',
    kind: TreeKind
}

export const compactNode = (node: ParseNode): any => {
    if ('value' in node) {
        return { [node.kind]: node.value }
    } else {
        return { [node.kind]: node.nodes.map(n => compactNode(n)) }
    }
}

/**
 * @see https://matklad.github.io/2023/05/21/resilient-ll-parsing-tutorial.html
 */
export class Parser {

    constructor(
        public tokens: ParseToken[],
        public pos: number = 0,
        public events: ParseEvent[] = [],
        public errors: SyntaxError[] = [],
        public fuel: number = 256
    ) {}

    open(): number {
        const mark = this.events.length
        this.events.push({ type: 'open', kind: 'error' })
        this.advanceIndependent()
        return mark
    }

    close(mark: number, kind: TreeKind): void {
        this.events[mark] = { type: 'open', kind }
        this.events.push({ type: 'close' })
    }

    advance(independent: boolean = true): void {
        if (this.eof()) throw Error('eof')
        this.fuel = 256
        this.events.push({ type: 'advance' })
        this.pos++
        if (independent) {
            this.advanceIndependent()
        }
    }

    advanceIndependent(): void {
        // TODO: attach comments to the preceding tree instead
        if (!this.eof() && independentTokenKinds.some(t => t === this.tokens[this.pos].kind)) {
            this.advance()
        }
    }

    eof(): boolean {
        return this.tokens[this.pos].kind === 'eof'
    }

    nth(lookahead: number): TokenKind {
        if (this.fuel === 0) throw Error('parser stuck')

        this.fuel--
        const t = this.tokens.at(this.pos + lookahead)
        return t ? t.kind : 'eof'
    }

    at(kind: TokenKind): boolean {
        return this.nth(0) === kind
    }

    atAny(kinds: TokenKind[]): boolean {
        return kinds.some(k => this.at(k))
    }

    consume(kind: TokenKind): boolean {
        if (this.at(kind)) {
            this.advance()
            return true
        } else {
            return false
        }
    }

    expect(kind: TokenKind): void {
        if (this.consume(kind)) {
            return
        }

        this.error({ expected: [kind], got: this.tokens[this.pos] })
    }

    expectAny(kinds: TokenKind[]): void {
        for (const kind of kinds) {
            if (this.consume(kind)) {
                return
            }
        }

        this.error({ expected: kinds, got: this.tokens[this.pos] })
    }

    advanceWithError(message: string): void {
        const mark = this.open()

        this.error({ expected: [], got: this.tokens[this.pos], message })

        this.advance()
        this.close(mark, 'error')
    }

    error(e: SyntaxError): void {
        if (this.errors.at(-1)?.got.location.start !== e.got.location.start) {
            this.errors.push(e)
        }
    }

    buildTree(): ParseTree {
        const tokens = this.tokens
        const events = this.events
        const stack: ParseTree[] = []

        if (events.pop()!.type !== 'close') throw Error('no matching `close` event')

        for (const event of events) {
            if (event.type === 'open') {
                stack.push({ kind: event.kind, nodes: [] })
            }
            if (event.type === 'close') {
                const tree = stack.pop()!
                stack.at(-1)!.nodes.push(tree)
            }
            if (event.type === 'advance') {
                const token = tokens.splice(0, 1)[0]
                stack.at(-1)!.nodes.push(token)
            }
        }

        if (stack.length !== 1) throw Error('unmatched events')
        if (tokens.length === 0) throw Error('unmatched tokens')

        return stack.pop()!
    }
}

const parseTodo = (parser: Parser): void => {
    parser.advanceWithError('todo')
}

const prefixOpFirstTokens: TokenKind[] = ['excl', 'minus', 'period', 'plus']
const postfixOpFirstTokens: TokenKind[] = ['o-paren']
const infixOpFirstTokens: TokenKind[] = ['ampersand', 'asterisk', 'c-angle', 'caret', 'equals', 'excl', 'minus',
    'o-angle', 'percent', 'period', 'pipe', 'plus', 'slash']
const exprFirstTokens: TokenKind[] = ['char', 'identifier', 'if-keyword', 'number', 'o-paren', 'string', ...prefixOpFirstTokens]
const statementFirstTokens: TokenKind[] = ['let-keyword', 'fn-keyword', 'return-keyword', 'type-keyword', ...exprFirstTokens]
const paramFirstTokens: TokenKind[] = ['identifier']

const exprFollowTokens: TokenKind[] = ['c-brace', 'c-paren', 'char', 'comma', 'excl', 'identifier', 'if-keyword',
    'let-keyword', 'minus', 'number', 'o-brace', 'o-paren', 'period', 'plus', 'return-keyword', 'string', 'type-keyword']

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
 * var-def ::= LET-KEYWORD IDENTIFIER type-annot? EQUALS expr
 */
const parseVarDef = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('let-keyword')
    parser.expect('identifier')
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
    parser.expect('type-keyword')
    parseTypeExpr(parser)
    parseBlock(parser)
    parser.close(mark, 'kind-def')
}

/**
 * impl-def ::= IMPL-KEYWORD type-expr impl-for? block
 */
const parseImplDef = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('type-keyword')
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
 * operand ::= if-expr | lambda-expr | O-PAREN expr C-PAREN | STRING | CHAR | NUMBER | IDENTIFIER | type-expr
 */
const parseOperand = (parser: Parser): void => {
    const dynamicTokens: TokenKind[] = ['string', 'char', 'number', 'identifier']

    const mark = parser.open()
    if (parser.at('if-keyword')) {
        parseIfExpr(parser)
    } else if (parser.at('pipe')) {
        parseLambdaExpr(parser)
    } else if (parser.at('o-paren')) {
        parser.expect('o-paren')
        parseExpr(parser)
        parser.expect('c-paren')
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
    } else if (parser.consume('period')) {
        parser.advance()
        parser.close(m, 'spread-op')
    } else {
        parser.advanceWithError('expected prefix operator')
    }

    parser.close(mark, 'prefix-op')
}

/**
 * postfix-op ::= call-op
 */
const parsePostfixOp = (parser: Parser): void => {
    const mark = parser.open()
    if (parser.at('o-paren')) {
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
    parser.expect('identifier')
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
