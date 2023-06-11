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
    'constructor',
    'con-params',
    'field-init',
    'params',
    'param',
    'block',
    'type-annot',
    'type-expr',
    'type-params',
    'if-expr',
    'pattern',
    'con-pattern',
    'con-pattern-params',
    'field-pattern',
    'hole',
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
