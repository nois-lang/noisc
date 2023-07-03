import { independentTokenKinds, ParseToken, TokenKind } from '../lexer/lexer'
import { SyntaxError } from '../error'
import { ParseTree, TreeKind } from './index'

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
        // TODO: attach comments to the subsequent tree instead
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

    advanceWithError(message: string, mark: number = this.open()): void {
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
