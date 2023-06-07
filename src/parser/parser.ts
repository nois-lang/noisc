import { ParseToken, TokenKind } from '../lexer/lexer'

export const treeKinds = <const>[
    'error',
    'module',
    'statement',
    'variable-def',
    'type-def',
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
    'fn-expr',
    'params',
    'param',
    'block',
    'type',
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

/**
 * @see https://matklad.github.io/2023/05/21/resilient-ll-parsing-tutorial.html
 */
export class Parser {

    constructor(
        public tokens: ParseToken[],
        public pos: number,
        public events: ParseEvent[],
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

    advance(): void {
        if (!this.eof()) throw Error('eof')
        this.fuel = 256
        this.events.push({ type: 'advance' })
        this.pos++
    }

    eof(): boolean {
        return this.pos === this.tokens.length
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

        // TODO: error reporting
        console.error('expected', kind)
    }

    expectAny(kinds: TokenKind[]): void {
        for (const kind of kinds) {
            if (this.consume(kind)) {
                return
            }
        }

        // TODO: error reporting
        console.error('expected', kinds)
    }

    advanceWithError(message: string): void {
        const mark = this.open()

        // TODO: error reporting
        console.error(message)

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
                const token = tokens[0]
                stack.at(-1)!.nodes.push(token)
            }
        }

        if (stack.length !== 1) throw Error('unmatched events')
        if (tokens.length === 0) throw Error('unmatched tokens')

        return stack.pop()!
    }
}

const parseTodo = (parser: Parser): void => {
    parser.advanceWithError('TODO')
}

const prefixOpFirstTokens: TokenKind[] = ['excl', 'minus', 'period', 'plus']
const postfixOpFirstTokens: TokenKind[] = ['o-paren']
const exprFirstTokens: TokenKind[] = ['char', 'identifier', 'if-keyword', 'number', 'o-paren', 'string', ...prefixOpFirstTokens]
const statementFirstTokens: TokenKind[] = ['let-keyword', 'return-keyword', 'type-keyword', ...exprFirstTokens]

const exprFollowTokens: TokenKind[] = ['c-brace', 'c-paren', 'char', 'comma', 'excl', 'identifier', 'if-keyword',
    'let-keyword', 'minus', 'number', 'o-brace', 'o-paren', 'period', 'plus', 'return-keyword', 'string', 'type-keyword']

const parseModule = (parser: Parser): void => {
    const mark = parser.open()

    while (!parser.eof()) {
        if (parser.atAny(statementFirstTokens)) {
            parseStatement(parser)
        } else {
            parser.advanceWithError('expected statement')
        }
    }
}
const parseStatement = (parser: Parser): void => {
    const mark = parser.open()

    if (parser.at('let-keyword')) {
        parseVariableDef(parser)
    } else if (parser.at('type-keyword')) {
        parseTypeDef(parser)
    } else if (parser.at('return-keyword')) {
        parseReturnStmt(parser)
    } else {
        parseExpr(parser)
    }

    parser.close(mark, 'statement')
}

const parseVariableDef = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('let-keyword')
    parser.expect('identifier')
    parser.expect('equals')
    parseExpr(parser)
    parser.close(mark, 'variable-def')
}

const parseTypeDef = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('type-keyword')
    parser.expect('identifier')
    parseTodo(parser)
    parser.close(mark, 'type-def')
}


const parseReturnStmt = (parser: Parser): void => {
    const mark = parser.open()
    parser.expect('return-keyword')
    // TODO: improve with newline
    if (!parser.at('c-brace')) {
        parseExpr(parser)
    }
    parser.close(mark, 'return-stmt')
}

const parseExpr = (parser: Parser): void => {
    const mark = parser.open()
    parseSubExpr(parser)
    while (!parser.atAny(exprFollowTokens) && !parser.eof()) {
        parseInfixOp(parser)
        parseSubExpr(parser)
    }
    parser.close(mark, 'expr')
}

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
const parseOperand = (parser: Parser): void => {
    const mark = parser.open()
    if (parser.at('if-keyword')) {
        parseIfExpr(parser)
    } else if (parser.at('pipe')) {
        parseFnExpr(parser)
    } else if (parser.at('o-paren')) {
        parser.expect('o-paren')
        parseExpr(parser)
        parser.expect('c-paren')
    } else if (parser.at('identifier') && parser.nth(1) === 'o-angle') {
        parseType(parser)
    } else {
        const dynamicTokens: TokenKind[] = ['string', 'char', 'number', 'identifier']
        if (parser.atAny(dynamicTokens)) {
            parser.expectAny(dynamicTokens)
        }
    }
    parser.close(mark, 'operand')
}

const parseInfixOp = (parser: Parser): void => {
    const mark = parser.open()
    parseTodo(parser)
    parser.close(mark, 'infix-op')
}

const parsePrefixOp = (parser: Parser): void => {
    const mark = parser.open()
    parseTodo(parser)
    parser.close(mark, 'prefix-op')
}

const parsePostfixOp = (parser: Parser): void => {
    const mark = parser.open()
    parseTodo(parser)
    parser.close(mark, 'postfix-op')
}

const parseIfExpr = (parser: Parser): void => {
    const mark = parser.open()
    parseTodo(parser)
    parser.close(mark, 'if-expr')
}

const parseFnExpr = (parser: Parser): void => {
    const mark = parser.open()
    parseTodo(parser)
    parser.close(mark, 'fn-expr')
}

const parseParenExpr = (parser: Parser): void => {
    const mark = parser.open()
    parseTodo(parser)
    parser.close(mark, 'expr')
}

const parseType = (parser: Parser): void => {
    const mark = parser.open()
    parseTodo(parser)
    parser.close(mark, 'type')
}

const parseA = (parser: Parser): void => {
    const mark = parser.open()
    parseTodo(parser)
    parser.close(mark, 'error')
}
