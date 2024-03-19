import { Span } from '../location'
import { NodeKind } from '../parser'

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

export const lexerDynamicKinds = <const>['name', 'string', 'char', 'int', 'float', 'bool']

const lexerParseIndependentKinds = <const>['comment']

const lexerSpecialKinds = <const>['unknown', 'unterminated-string', 'unterminated-char', 'eof']

export const lexerTokenKinds = <const>[
    ...lexerKeywordKinds,
    ...lexerPunctuationKinds,
    ...lexerOperatorKinds,
    ...lexerDynamicKinds,
    ...lexerParseIndependentKinds,
    ...lexerSpecialKinds
]

export type TokenKind = (typeof lexerTokenKinds)[number]

export const erroneousTokenKinds: TokenKind[] = ['unknown', 'unterminated-char', 'unterminated-string']

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
const escapeCharReg = /(\\[tnr\\])/
const unicodeCharReg = /(\\u{[0-9a-fA-F]{1,4}})/
const charRegex = new RegExp(
    `^'(${["(\\\\')", /[^\\\t\n\r']/.source, escapeCharReg.source, unicodeCharReg.source].join('|')})'`
)
const stringRegex = new RegExp(
    `^"(${['(\\\\")', /[^\\\t\n\r"]/.source, escapeCharReg.source, unicodeCharReg.source].join('|')})*"`
)

/**
 * Independent tokens are tokens that do not hold semantic meaning and automatically advanced by parser
 */
export const independentTokenKinds: NodeKind[] = ['comment']

export const isWhitespace = (char: string): boolean => char === ' ' || char === '\t'

export const isNewline = (char: string): boolean => char === '\n' || char === '\r'

export const tokenize = (code: string): LexerToken[] => {
    const pos = { pos: 0 }
    const chars = code.split('')
    const tokens: LexerToken[] = []

    let unknownToken: LexerToken | undefined = undefined

    const flushUnknown = () => {
        if (unknownToken) {
            unknownToken.value = code.slice(unknownToken.span.start, unknownToken.span.end)
            tokens.push(unknownToken)
            unknownToken = undefined
        }
    }

    while (pos.pos < chars.length) {
        if (isWhitespace(chars[pos.pos]) || isNewline(chars[pos.pos])) {
            pos.pos++
            flushUnknown()
            continue
        }

        const fns = [
            parseFloat,
            parseInt,
            parseComment,
            parseConstToken(lexerKeywordMap),
            parseConstToken(boolMap),
            parseName,
            parseCharLiteral,
            parseStringLiteral
        ]

        let parsed = false
        for (const f of fns) {
            if (f(chars, tokens, pos)) {
                flushUnknown()
                parsed = true
                break
            }
        }

        if (!parsed) {
            if (unknownToken) {
                unknownToken!.value += chars[pos.pos]
                unknownToken!.span.end++
            } else {
                unknownToken = {
                    kind: 'unknown',
                    value: '',
                    span: { start: pos.pos, end: pos.pos + 1 }
                }
            }
            pos.pos++
        }
    }

    flushUnknown()
    pos.pos++
    tokens.push(createToken('eof', '', pos, pos.pos - 1))

    return tokens
}

const parseComment = (chars: string[], tokens: LexerToken[], pos: { pos: number }): boolean => {
    if (chars[pos.pos] !== '/') return false
    if (chars.slice(pos.pos, pos.pos + 2).join('') === '//') {
        const start = pos.pos
        const buffer: string[] = []
        while (!isNewline(chars[pos.pos])) {
            buffer.push(chars[pos.pos])
            pos.pos++
        }
        tokens.push(createToken('comment', buffer.join(''), pos, start))
        return true
    }
    return false
}

const parseConstToken =
    (constMap: [TokenKind, string][]) =>
    (chars: string[], tokens: LexerToken[], pos: { pos: number }): boolean => {
        for (const [kind, value] of constMap) {
            if (chars[pos.pos] !== value[0]) continue
            const actual = chars.slice(pos.pos, pos.pos + value.length).join('')
            const trailing = chars.at(pos.pos + value.length)
            if (actual === value && (!isAlpha(value[0]) || !trailing || !isAlpha(trailing))) {
                const start = pos.pos
                pos.pos += value.length
                tokens.push(createToken(kind, value, pos, start))
                return true
            }
        }
        return false
    }

const parseName = (chars: string[], tokens: LexerToken[], pos: { pos: number }): boolean => {
    if (!isAlpha(chars[pos.pos])) return false
    const start = pos.pos
    const name: string[] = []
    while (isAlpha(chars[pos.pos]) || isNumeric(chars[pos.pos])) {
        name.push(chars[pos.pos])
        pos.pos++
    }
    tokens.push(createToken('name', name.join(''), pos, start))
    return true
}

const parseFloat = (chars: string[], tokens: LexerToken[], pos: { pos: number }): boolean => {
    if (!isNumeric(chars[pos.pos]) && chars[pos.pos] !== '.') return false
    const leftCode = chars.slice(pos.pos).join('')
    const match = leftCode.match(floatRegex)
    if (!match) return false

    const float = match[0]
    const start = pos.pos
    pos.pos += float.length
    tokens.push(createToken('float', float, pos, start))
    return true
}

const parseInt = (chars: string[], tokens: LexerToken[], pos: { pos: number }): boolean => {
    if (!isNumeric(chars[pos.pos])) return false
    const start = pos.pos
    let int = ''
    while (isNumeric(chars[pos.pos])) {
        int += chars[pos.pos]
        pos.pos++
    }
    if (int.length === 0) return false

    tokens.push(createToken('int', int, pos, start))
    return true
}

const parseCharLiteral = (chars: string[], tokens: LexerToken[], pos: { pos: number }): boolean => {
    const quote = `'`
    if (chars[pos.pos] !== quote) return false

    const leftCode = chars.slice(pos.pos).join('')
    const match = leftCode.match(charRegex)
    if (match) {
        const start = pos.pos
        const char = match[0]
        pos.pos += char.length
        tokens.push(createToken('char', char, pos, start))
    } else {
        parseUnterminatedChar(chars, tokens, pos)
    }

    return true
}

const parseUnterminatedChar = (chars: string[], tokens: LexerToken[], pos: { pos: number }): void => {
    const quote = `'`
    const start = pos.pos
    pos.pos++
    let char = quote
    while (pos.pos !== chars.length && !isNewline(chars[pos.pos])) {
        char += chars[pos.pos]
        pos.pos++
        if (chars[pos.pos - 1] === quote) {
            break
        }
    }
    tokens.push(createToken('unterminated-char', char, pos, start))
}

const parseStringLiteral = (chars: string[], tokens: LexerToken[], pos: { pos: number }): boolean => {
    const quote = '"'
    if (chars[pos.pos] !== quote) return false

    const leftCode = chars.slice(pos.pos).join('')
    const match = leftCode.match(stringRegex)
    if (match) {
        const start = pos.pos
        const str = match[0]
        pos.pos += str.length
        tokens.push(createToken('string', str, pos, start))
    } else {
        parseUnterminatedString(chars, tokens, pos)
    }

    return true
}

const parseUnterminatedString = (chars: string[], tokens: LexerToken[], pos: { pos: number }): void => {
    const quote = '"'
    const start = pos.pos
    pos.pos++
    let str = quote
    while (pos.pos !== chars.length && !isNewline(chars[pos.pos])) {
        str += chars[pos.pos]
        pos.pos++
    }
    tokens.push(createToken('unterminated-string', str, pos, start))
    return
}

const createToken = (name: TokenKind, value: string, pos: { pos: number }, start: number): LexerToken => {
    return { kind: name, value, span: { start, end: pos.pos } }
}

const isAlpha = (char: string): boolean =>
    (char >= 'A' && char <= 'Z') || (char >= 'a' && char <= 'z') || (char >= 'a' && char <= 'z') || char === '_'

const isNumeric = (char: string): boolean => char >= '0' && char <= '9'
