import { Span } from '../location'
import { NodeKind } from '../parser'
import { assert, todo, unreachable } from '../util/todo'

export const lexerOperatorKinds = <const>[
    'plus',
    'minus',
    'asterisk',
    'slash',
    'caret',
    'percent',
    'ampersand',
    'pipe',
    'excl',
    'qmark',
    'period'
]

export const lexerPunctuationKinds = <const>[
    'o-paren',
    'c-paren',
    'o-bracket',
    'c-bracket',
    'o-brace',
    'c-brace',
    'o-angle',
    'c-angle',
    'd-quote',
    'colon',
    'comma',
    'equals',
    'underscore',
    'at'
]

export const lexerKeywordKinds = <const>[
    'use-keyword',
    'type-keyword',
    'trait-keyword',
    'impl-keyword',
    'let-keyword',
    'fn-keyword',
    'if-keyword',
    'else-keyword',
    'return-keyword',
    'break-keyword',
    'while-keyword',
    'for-keyword',
    'in-keyword',
    'match-keyword',
    'pub-keyword'
]

export const lexerDynamicKinds = <const>['name', 'string-part', 'char', 'int', 'float', 'bool']

const lexerParseIndependentKinds = <const>['comment']

const lexerSpecialKinds = <const>['unknown', 'unterminated-string', 'char-unterminated', 'eof']

export const lexerTokenKinds = <const>[
    ...lexerKeywordKinds,
    ...lexerPunctuationKinds,
    ...lexerOperatorKinds,
    ...lexerDynamicKinds,
    ...lexerParseIndependentKinds,
    ...lexerSpecialKinds
]

export type TokenKind = (typeof lexerTokenKinds)[number]

export const erroneousTokenKinds: TokenKind[] = ['unknown', 'char-unterminated']

export interface LexerToken {
    kind: TokenKind
    value: string
    span: Span
}

export const lexerKeywordMap: [TokenKind, string][] = [
    ['use-keyword', 'use'],
    ['type-keyword', 'type'],
    ['trait-keyword', 'trait'],
    ['if-keyword', 'if'],
    ['else-keyword', 'else'],
    ['return-keyword', 'return'],
    ['break-keyword', 'break'],
    ['impl-keyword', 'impl'],
    ['let-keyword', 'let'],
    ['fn-keyword', 'fn'],
    ['while-keyword', 'while'],
    ['for-keyword', 'for'],
    ['in-keyword', 'in'],
    ['match-keyword', 'match'],
    ['pub-keyword', 'pub'],

    ['o-paren', '('],
    ['c-paren', ')'],
    ['o-bracket', '['],
    ['c-bracket', ']'],
    ['o-brace', '{'],
    ['c-brace', '}'],
    ['o-angle', '<'],
    ['c-angle', '>'],

    ['plus', '+'],
    ['minus', '-'],
    ['asterisk', '*'],
    ['slash', '/'],
    ['caret', '^'],
    ['percent', '%'],
    ['ampersand', '&'],
    ['pipe', '|'],
    ['excl', '!'],
    ['qmark', '?'],
    ['period', '.'],

    ['colon', ':'],
    ['comma', ','],
    ['equals', '='],
    ['underscore', '_'],
    ['at', '@']
]

export const boolMap: [TokenKind, string][] = [
    ['bool', 'true'],
    ['bool', 'false']
]

const floatRegex = /^((\d+(\.\d*)?e[+-]?\d+)|(\d+\.\d*)|(\d*\.\d+))/

/**
 * Independent tokens are tokens that do not hold semantic meaning and automatically advanced by parser
 */
export const independentTokenKinds: NodeKind[] = ['comment']

export const isWhitespace = (char: string): boolean => char === ' ' || char === '\t'

export const isNewline = (char: string): boolean => char === '\n' || char === '\r'

interface LexerContext {
    code: string
    pos: number
    tokens: LexerToken[]
    inString: number
    inIntepolation: number
}

export const tokenize = (code: string): LexerToken[] => {
    const ctx: LexerContext = {
        code,
        pos: 0,
        tokens: [],
        inString: 0,
        inIntepolation: 0
    }

    let unknownToken: LexerToken | undefined = undefined

    const flushUnknown = () => {
        if (unknownToken) {
            unknownToken.value = code.slice(unknownToken.span.start, unknownToken.span.end)
            ctx.tokens.push(unknownToken)
            unknownToken = undefined
        }
    }

    while (ctx.pos < ctx.code.length) {
        if (isWhitespace(ctx.code[ctx.pos]) || isNewline(ctx.code[ctx.pos])) {
            ctx.pos++
            flushUnknown()
            continue
        }

        const fns = [
            parseLeaveInterpolation,
            parseFloat,
            parseInt,
            parseComment,
            parseConstToken(lexerKeywordMap),
            parseConstToken(boolMap),
            parseCharLiteral,
            parseStringPart,
            parseName,
            parseStringLiteral
        ]

        let parsed = false
        for (const f of fns) {
            if (f(ctx)) {
                flushUnknown()
                parsed = true
                break
            }
        }

        if (!parsed) {
            if (unknownToken) {
                unknownToken!.value += ctx.code[ctx.pos]
                unknownToken!.span.end++
            } else {
                unknownToken = {
                    kind: 'unknown',
                    value: '',
                    span: { start: ctx.pos, end: ctx.pos + 1 }
                }
            }
            ctx.pos++
        }
    }

    flushUnknown()
    ctx.pos++
    ctx.tokens.push(createToken('eof', '', ctx.pos, ctx.pos - 1))

    return ctx.tokens
}

const parseComment = (ctx: LexerContext): boolean => {
    if (ctx.inString !== 0) return false
    if (ctx.code[ctx.pos] !== '/') return false
    if (ctx.code.slice(ctx.pos, ctx.pos + 2) === '//') {
        const start = ctx.pos
        const buffer: string[] = []
        while (!isNewline(ctx.code[ctx.pos])) {
            buffer.push(ctx.code[ctx.pos])
            ctx.pos++
        }
        ctx.tokens.push(createToken('comment', buffer.join(''), ctx.pos, start))
        return true
    }
    return false
}

const parseConstToken =
    (constMap: [TokenKind, string][]) =>
    (ctx: LexerContext): boolean => {
        if (ctx.inString > ctx.inIntepolation) return false
        for (const [kind, value] of constMap) {
            if (ctx.code[ctx.pos] !== value[0]) continue
            const actual = ctx.code.slice(ctx.pos, ctx.pos + value.length)
            const trailing = ctx.code.at(ctx.pos + value.length)
            if (actual === value && (!isAlpha(value[0]) || !trailing || !isAlpha(trailing))) {
                const start = ctx.pos
                ctx.pos += value.length
                ctx.tokens.push(createToken(kind, value, ctx.pos, start))
                return true
            }
        }
        return false
    }

const parseName = (ctx: LexerContext): boolean => {
    if (ctx.inString > ctx.inIntepolation) return false
    if (!isAlpha(ctx.code[ctx.pos])) return false
    const start = ctx.pos
    const name: string[] = []
    while (isAlpha(ctx.code[ctx.pos]) || isNumeric(ctx.code[ctx.pos])) {
        name.push(ctx.code[ctx.pos])
        ctx.pos++
    }
    ctx.tokens.push(createToken('name', name.join(''), ctx.pos, start))
    return true
}

const parseFloat = (ctx: LexerContext): boolean => {
    if (ctx.inString > ctx.inIntepolation) return false
    if (!isNumeric(ctx.code[ctx.pos]) && ctx.code[ctx.pos] !== '.') return false
    const leftCode = ctx.code.slice(ctx.pos)
    const match = leftCode.match(floatRegex)
    if (!match) return false

    const float = match[0]
    const start = ctx.pos
    ctx.pos += float.length
    ctx.tokens.push(createToken('float', float, ctx.pos, start))
    return true
}

const parseInt = (ctx: LexerContext): boolean => {
    if (ctx.inString > ctx.inIntepolation) return false
    if (!isNumeric(ctx.code[ctx.pos])) return false
    const start = ctx.pos
    let int = ''
    while (isNumeric(ctx.code[ctx.pos])) {
        int += ctx.code[ctx.pos]
        ctx.pos++
    }
    if (int.length === 0) return false

    ctx.tokens.push(createToken('int', int, ctx.pos, start))
    return true
}

const parseCharLiteral = (ctx: LexerContext): boolean => {
    if (ctx.inString > ctx.inIntepolation) return false
    const quote = "'"
    if (ctx.code[ctx.pos] !== quote) return false
    let char = quote
    const start = ctx.pos
    ctx.pos++
    if (ctx.pos < ctx.code.length) {
        if (ctx.code[ctx.pos] === quote) {
            char += quote
            ctx.pos++
            ctx.tokens.push(createToken('char-unterminated', char, ctx.pos, start))
            return true
        }
        const n = nextChar(ctx.code, ctx.pos, 'char')
        if (n) {
            char += n
            ctx.pos += n.length

            if (ctx.code[ctx.pos] === quote) {
                char += quote
                ctx.pos++
                ctx.tokens.push(createToken('char', char, ctx.pos, start))
                return true
            }
        }
    }
    ctx.pos = start + 1
    ctx.tokens.push(createToken('char-unterminated', quote, ctx.pos, start))
    return true
}

const parseStringLiteral = (ctx: LexerContext): boolean => {
    const c = ctx.code[ctx.pos]
    if (c === '"') {
        if (ctx.inString > ctx.inIntepolation) {
            ctx.inString--
        } else {
            assert(ctx.inString === ctx.inIntepolation)
            ctx.inString++
        }
        const start = ctx.pos
        ctx.pos++
        ctx.tokens.push(createToken('d-quote', '"', ctx.pos, start))
        return true
    }
    if (ctx.inString > 0 && ctx.inString > ctx.inIntepolation) {
        if (c === '{') {
            ctx.inIntepolation++
            const start = ctx.pos
            ctx.pos++
            ctx.tokens.push(createToken('o-brace', '{', ctx.pos, start))
            return true
        }
        return unreachable()
    }
    return false
}

const parseLeaveInterpolation = (ctx: LexerContext): boolean => {
    if (ctx.inIntepolation === 0 || ctx.inString > ctx.inIntepolation) return false
    if (ctx.code[ctx.pos] !== '}') return false
    ctx.inIntepolation--
    const start = ctx.pos
    ctx.pos++
    ctx.tokens.push(createToken('c-brace', '}', ctx.pos, start))
    return true
}

const parseStringPart = (ctx: LexerContext): boolean => {
    if (ctx.inString === 0 || ctx.inString <= ctx.inIntepolation) return false
    const start = ctx.pos
    let part = ''
    while (ctx.pos < ctx.code.length && ctx.code[ctx.pos] !== '{' && ctx.code[ctx.pos] !== '"') {
        const c = nextChar(ctx.code, ctx.pos, 'string')
        if (!c) {
            return todo('how?')
        }
        part += c
        ctx.pos += c.length
    }
    if (part.length > 0) {
        ctx.tokens.push(createToken('string-part', part, ctx.pos, start))
        return true
    }
    return false
}

const nextChar = (code: string, pos: number, mode: 'string' | 'char'): string | undefined => {
    const c = code[pos]
    if (c === '"' && mode === 'string') return undefined
    if (mode === 'char' && (c === "'" || c === '\n')) return undefined
    if (c === '\\') {
        const n = code[pos + 1]
        if (n === 'n' || n === 'r' || n === 't' || n === '\\') {
            return c + n
        }
        if (n === 'u' && code[pos + 2] === '{') {
            let res = c + n + '{'
            for (let i = 0; i < 5; i++) {
                const d = code[pos + 3 + i]
                if (i > 0 && d === '}') {
                    return res + '}'
                }
                if (isHex(d)) {
                    res += d
                } else {
                    return undefined
                }
            }
            return undefined
        }
        if (mode === 'string') {
            if (n === '{' || n === '"') {
                return c + n
            } else {
                return undefined
            }
        } else {
            if (n === "'") {
                return c + n
            } else {
                return undefined
            }
        }
    }
    return c
}

const createToken = (name: TokenKind, value: string, end: number, start: number): LexerToken => {
    return { kind: name, value, span: { start, end: end } }
}

const isAlpha = (char: string): boolean => (char >= 'A' && char <= 'Z') || (char >= 'a' && char <= 'z') || char === '_'

const isNumeric = (char: string): boolean => char >= '0' && char <= '9'

const isHex = (char: string): boolean => isNumeric(char) || (char >= 'A' && char <= 'F') || (char >= 'a' && char <= 'f')
