import { SyntaxError } from '../error'
import { LexerToken, TokenKind, independentTokenKinds, lexerDynamicKinds } from '../lexer/lexer'
import { Span } from '../location'
import { Source } from '../source'
import { nameLikeTokens } from './fns'

export const treeKinds = <const>[
    'error',
    'module',
    'statement',
    'use-stmt',
    'use-expr',
    'use-list',
    'var-def',
    'fn-def',
    'generics',
    'generic',
    'generic-bounds',
    'params',
    'param',
    'trait-def',
    'impl-def',
    'impl-for',
    'type-def',
    'variant-params',
    'field-def',
    'variant-list',
    'variant',
    'return-stmt',
    'break-stmt',
    'expr',
    'sub-expr',
    'operand',
    'list-expr',
    'infix-op',
    'add-op',
    'sub-op',
    'mult-op',
    'div-op',
    'exp-op',
    'mod-op',
    'eq-op',
    'ne-op',
    'ge-op',
    'le-op',
    'gt-op',
    'lt-op',
    'and-op',
    'or-op',
    'assign-op',
    'method-call-op',
    'field-access-op',
    'call-op',
    'unwrap-op',
    'bind-op',
    'await-op',
    'access-op',
    'arg',
    'closure-expr',
    'closure-params',
    'identifier',
    'block',
    'type-annot',
    'type',
    'variant-type',
    'type-args',
    'type-bounds',
    'fn-type',
    'fn-type-params',
    'if-expr',
    'if-let-expr',
    'while-expr',
    'for-expr',
    'match-expr',
    'match-clauses',
    'match-clause',
    'guard',
    'patterns',
    'pattern',
    'pattern-bind',
    'pattern-expr',
    'con-pattern',
    'con-pattern-params',
    'list-pattern',
    'field-pattern',
    'hole',
    'number',
    'string',
    'string-part'
]
export type TreeKind = (typeof treeKinds)[number]

export type NodeKind = TokenKind | TreeKind

export interface ParseTree {
    kind: TreeKind
    nodes: ParseNode[]
}

export type ParseNode = LexerToken | ParseTree

export const parseNodeKinds: NodeKind[] = [
    ...lexerDynamicKinds,
    ...nameLikeTokens,
    ...treeKinds,
    'minus',
    'pub-keyword'
]

export const filterNonAstNodes = (node: ParseNode): ParseNode[] =>
    (<ParseTree>node).nodes.filter(n => parseNodeKinds.includes(n.kind))

export const compactParseNode = (node: ParseNode): any => {
    if ('value' in node) {
        return { [node.kind]: node.value }
    } else {
        return { [node.kind]: node.nodes.map(n => compactParseNode(n)) }
    }
}

export const getSpan = (node: ParseNode): Span => {
    if ('nodes' in node && node.nodes.length === 0) return { start: 0, end: 0 }
    const leftmostNode = (node: ParseNode): LexerToken => {
        if ('nodes' in node) {
            return leftmostNode(node.nodes[0])
        } else {
            return node
        }
    }
    const rightmostNode = (node: ParseNode): LexerToken => {
        if ('nodes' in node) {
            return rightmostNode(node.nodes.at(-1)!)
        } else {
            return node
        }
    }
    return { start: leftmostNode(node).span.start, end: rightmostNode(node).span.end }
}

export const parseNodeCode = (node: ParseNode, source: Source): string => {
    const range = getSpan(node)
    return source.code.slice(range.start, range.end)
}

export type ParseEvent = { type: 'open'; kind: TreeKind } | { type: 'close' } | { type: 'advance' }

/**
 * @see https://matklad.github.io/2023/05/21/resilient-ll-parsing-tutorial.html
 */
export class Parser {
    constructor(
        public tokens: LexerToken[],
        public pos: number = 0,
        public events: ParseEvent[] = [],
        public errors: SyntaxError[] = [],
        public independentCount: number | undefined = undefined,
        public fuel: number = 256
    ) {}

    open(): number {
        const mark = this.events.length
        this.events.push({ type: 'open', kind: 'error' })
        this.replayIndependent()
        this.advanceIndependent()
        return mark
    }

    close(mark: number, kind: TreeKind): void {
        this.events[mark] = { type: 'open', kind }
        this.events.push({ type: 'close' })
    }

    advance(): void {
        if (this.eof()) throw Error('eof')
        this.fuel = 256
        this.events.push({ type: 'advance' })
        this.pos++
        this.recordIndependent()
    }

    /**
     * Independent tokens should are attached to the parse node that is coming right after it.
     * To do that, incoming independent token count is stored until advance() or open() call
     */
    recordIndependent(): void {
        this.replayIndependent()
        for (let i = 0; ; i++) {
            if (!independentTokenKinds.includes(this.nth(i))) {
                this.independentCount = i
                this.pos += i
                return
            }
        }
    }

    replayIndependent(): void {
        if (this.independentCount === undefined) return
        for (let i = 0; i < this.independentCount; i++) {
            this.events.push({ type: 'advance' })
        }
        this.independentCount = undefined
    }

    advanceIndependent(): void {
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

    atOptionalFirst(first: TokenKind, kind: TokenKind): boolean {
        if (this.at(first)) {
            return this.nth(1) === kind
        }
        return this.at(kind)
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

        this.advanceWithError({ expected: kinds, got: this.tokens[this.pos] })
    }

    advanceWithError(e: SyntaxError, mark: number = this.open()): void {
        this.error(e)

        if (!this.eof()) {
            this.advance()
        }
        this.close(mark, 'error')
    }

    error(e: SyntaxError): void {
        if (this.errors.at(-1)?.got.span.start !== e.got.span.start) {
            this.errors.push(e)
        }
    }

    /**
     * Check if `target` token is encountered before any other tokens *not* listed in `whitelist`
     */
    encounter(target: TokenKind, whitelist: TokenKind[], from: number = 0): boolean {
        let i = this.pos + from
        while (i < this.tokens.length) {
            const token = this.tokens.at(i)?.kind || 'eof'
            if (token === target) {
                return true
            }
            if (!whitelist.includes(token)) {
                return false
            }
            i++
        }
        return false
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
