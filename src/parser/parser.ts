import { independentTokenKinds, ParseToken, TokenKind } from '../lexer/lexer'
import { SyntaxError } from '../error'

export const treeKinds = <const>[
    'error',
    'module',
    'statement',
    'var-def',
    'fn-def',
    'type-def',
    'constr-params',
    'constr-list',
    'constructor',
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
        return mark
    }

    close(mark: number, kind: TreeKind): void {
        this.events[mark] = { type: 'open', kind }
        this.events.push({ type: 'close' })
    }

    advance(skipIndependent: boolean = true): void {
        if (this.eof()) throw Error('eof')
        this.fuel = 256
        this.events.push({ type: 'advance' })
        this.pos++
        if (skipIndependent && !this.eof() && independentTokenKinds.has(this.tokens[this.pos].kind)) {
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

        this.errors.push({ expected: [kind], got: this.tokens[this.pos] })
    }

    expectAny(kinds: TokenKind[]): void {
        for (const kind of kinds) {
            if (this.consume(kind)) {
                return
            }
        }

        this.errors.push({ expected: kinds, got: this.tokens[this.pos] })
    }

    advanceWithError(message: string): void {
        const mark = this.open()

        this.errors.push({ expected: [], got: this.tokens[this.pos], message })

        this.advance()
        this.close(mark, 'error')
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
 * statement ::= var-def | fn-def | type-def | return-stmt | expr
 */
const parseStatement = (parser: Parser): void => {
    const mark = parser.open()

    if (parser.at('let-keyword')) {
        parseVarDef(parser)
    } else if (parser.at('fn-keyword')) {
        parseFnDef(parser)
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
 * fn-def ::= FN-KEYWORD IDENTIFIER type-params? O-PAREN params? C-PAREN type-annot? block?
 */
const parseFnDef = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('fn-keyword')
    parser.expect('identifier')
    if (parser.at('o-angle')) {
        parseTypeParams(parser)
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
 * type-def ::= TYPE-KEYWORD type-expr (constr-params | constr-list)
 */
const parseTypeDef = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('type-keyword')
    parseTypeExpr(parser)
    if (parser.at('o-paren')) {
        parseConstrParams(parser)
    } else if (parser.at('o-brace')) {
        parseConstrList(parser)
    } else {
        parser.advanceWithError('expected `(` or `{`')
    }
    parser.close(mark, 'type-def')
}

/**
 * constr-params ::= O-PAREN params? C-PAREN
 */
const parseConstrParams = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-paren')
    if (!parser.at('c-paren')) {
        parseParams(parser)
    }
    parser.expect('c-paren')
    parser.close(mark, 'constr-params')
}

/**
 * constr-list ::= O-BRACE (constructor (COMMA constructor)* COMMA?)? C-BRACE
 */
const parseConstrList = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-brace')
    while (!parser.at('c-brace') && !parser.eof()) {
        parseConstructor(parser)
        parser.consume('comma')
    }
    parser.expect('c-brace')
    parser.close(mark, 'constr-list')
}

/**
 * constructor ::= IDENTIFIER constr-params?
 */
const parseConstructor = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('identifier')
    if (!parser.atAny(['comma', 'c-paren'])) {
        parseConstrParams(parser)
    }
    parser.close(mark, 'constructor')
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
        parser.consume('comma')
    }
    parser.expect('c-paren')
    parser.close(mark, 'args')
}

/**
 * lambda-expr ::= lambda-params type-annot? block
 */
const parseLambdaExpr = (parser: Parser): void => {
    const mark = parser.open()
    parseLambdaParams(parser)
    if (parser.at('colon')) {
        parseTypeAnnot(parser)
    }
    parseBlock(parser)
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
        parser.consume('comma')
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
    while (!parser.at('c-paren') && !parser.eof()) {
        parseParam(parser)
        parser.consume('comma')
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
 * block ::= O-BRACE statement* C-BRACE | O-BRACE C-BRACE
 */
const parseBlock = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('o-brace')
    while (parser.atAny(statementFirstTokens) && !parser.eof()) {
        parseStatement(parser)
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
        parser.consume('comma')
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
