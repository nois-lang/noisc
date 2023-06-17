import { LocationRange } from '../location'
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
    'arrow']

export const lexerKeywordKinds = <const>[
    'use-keyword',
    'type-keyword',
    'kind-keyword',
    'impl-keyword',
    'let-keyword',
    'fn-keyword',
    'if-keyword',
    'else-keyword',
    'return-keyword',
    'while-keyword',
    'for-keyword',
    'in-keyword',
    'match-keyword'
]

export const lexerDynamicKinds = <const>['name', 'string', 'char', 'int', 'float']

const lexerParseIndependentKinds = <const>['newline', 'comment']

const lexerSpecialKinds = <const>['unknown', 'unterminated-string', 'unterminated-char', 'eof']

export const lexerTokenKinds = <const>[
    ...lexerKeywordKinds,
    ...lexerPunctuationKinds,
    ...lexerOperatorKinds,
    ...lexerDynamicKinds,
    ...lexerParseIndependentKinds,
    ...lexerSpecialKinds
]

export type TokenKind = typeof lexerTokenKinds[number]

export const erroneousTokenKinds: TokenKind[] = ['unknown', 'unterminated-char', 'unterminated-string']

export interface ParseToken {
    kind: TokenKind
    value: string
    location: LocationRange
}

export const constTokenKindMap: Map<TokenKind, string> = new Map([
    ['use-keyword', 'use'],
    ['type-keyword', 'type'],
    ['kind-keyword', 'kind'],
    ['if-keyword', 'if'],
    ['else-keyword', 'else'],
    ['return-keyword', 'return'],
    ['impl-keyword', 'impl'],
    ['let-keyword', 'let'],
    ['fn-keyword', 'fn'],
    ['while-keyword', 'while'],
    ['for-keyword', 'for'],
    ['in-keyword', 'in'],
    ['match-keyword', 'match'],

    ['o-paren', '('],
    ['c-paren', ')'],
    ['o-bracket', '['],
    ['c-bracket', ']'],
    ['o-brace', '{'],
    ['c-brace', '}'],
    ['o-angle', '<'],
    ['c-angle', '>'],

    ['arrow', '->'],

    ['plus', '+'],
    ['minus', '-'],
    ['asterisk', '*'],
    ['slash', '/'],
    ['caret', '^'],
    ['percent', '%'],
    ['ampersand', '&'],
    ['pipe', '|'],
    ['excl', '!'],
    ['period', '.'],

    ['colon', ':'],
    ['comma', ','],
    ['equals', '='],
    ['underscore', '_'],
])

const intRegex = /^\d+/
const floatRegex = /^((\d+(\.\d*)?e[+-]?\d+)|(\d+\.\d*)|(\d*\.\d+))/
const singleCharRegex = /(([^\\\n\r])|(\\[abtnvfr\\'"])|(\\u{[0-9a-fA-F]{1,4}}))/
const charRegex = new RegExp(`^'((\\')|` + singleCharRegex.source + `)'`)
const stringRegex = new RegExp(`^"((\\")|` + singleCharRegex.source + `)+"`)

/**
 * Independent tokens are automatically advanced by parser by default
 */
export const independentTokenKinds: NodeKind[] = ['newline', 'comment']

export const isWhitespace = (char: string): boolean => char === ' ' || char === '\t'

export const isNewline = (char: string): boolean => char === '\n' || char === '\r'

export const tokenize = (code: String): ParseToken[] => {
    const pos = { pos: 0 }
    const chars = code.split('')
    const tokens: ParseToken[] = []

    let unknownToken: ParseToken | undefined = undefined

    const flushUnknown = () => {
        if (unknownToken) {
            unknownToken.value = code.slice(unknownToken.location.start, unknownToken.location.end + 1)
            tokens.push(unknownToken)
            unknownToken = undefined
        }
    }

    while (pos.pos < chars.length) {
        if (isWhitespace(chars[pos.pos])) {
            pos.pos++
            flushUnknown()
            continue
        }

        const fns = [parseFloat, parseInt, parseComment, parseNewline, parseConstToken, parseName,
            parseCharLiteral, parseStringLiteral]

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
                unknownToken!.location.end++
            } else {
                unknownToken = {
                    kind: 'unknown',
                    value: '',
                    location: { start: pos.pos, end: pos.pos }
                }
            }
            pos.pos++
        }
    }

    pos.pos++
    tokens.push(createToken('eof', '', pos, pos.pos - 1))

    return tokens
}

const parseComment = (chars: string[], tokens: ParseToken[], pos: { pos: number }): boolean => {
    if (chars.slice(pos.pos, pos.pos + 2).join('') === '//') {
        const start = pos.pos
        let buffer: string[] = []
        while (!isNewline(chars[pos.pos])) {
            buffer.push(chars[pos.pos])
            pos.pos++
        }
        tokens.push(createToken('comment', buffer.join(''), pos, start))
        return true
    }
    return false
}

const parseNewline = (chars: string[], tokens: ParseToken[], pos: { pos: number }): boolean => {
    if (isNewline(chars[pos.pos])) {
        const start = pos.pos
        let buffer: string[] = []
        while (isNewline(chars[pos.pos])) {
            buffer.push(chars[pos.pos])
            pos.pos++
        }
        tokens.push(createToken('newline', buffer.join(''), pos, start))
        return true
    }
    return false
}

const parseConstToken = (chars: string[], tokens: ParseToken[], pos: { pos: number }): boolean => {
    let codeLeft = chars.slice(pos.pos).join('')
    let pair = [...constTokenKindMap.entries()].find(([, v]) => {
        if (!isAlpha(v[0])) {
            return codeLeft.startsWith(v)
        } else {
            const trailingChar = codeLeft.at(v.length)
            return codeLeft.startsWith(v) && (!trailingChar || !isAlpha(trailingChar))
        }
    })
    if (pair) {
        const [kind, value] = pair
        const start = pos.pos
        pos.pos += value.length
        tokens.push(createToken(kind, value, pos, start))
        return true
    }
    return false
}

const parseName = (chars: string[], tokens: ParseToken[], pos: { pos: number }): boolean => {
    if (isAlpha(chars[pos.pos])) {
        const start = pos.pos
        const name: string[] = []
        while (isAlpha(chars[pos.pos]) || isNumeric(chars[pos.pos])) {
            name.push(chars[pos.pos])
            pos.pos++
        }
        tokens.push(createToken('name', name.join(''), pos, start))
        return true
    }
    return false
}

const parseFloat = (chars: string[], tokens: ParseToken[], pos: { pos: number }): boolean => {
    const leftCode = chars.slice(pos.pos).join('')
    const match = leftCode.match(floatRegex)
    if (!match) return false

    const float = match[0]
    const start = pos.pos
    pos.pos += float.length
    tokens.push(createToken('float', float, pos, start))
    return true
}

const parseInt = (chars: string[], tokens: ParseToken[], pos: { pos: number }): boolean => {
    const leftCode = chars.slice(pos.pos).join('')
    const match = leftCode.match(intRegex)
    if (!match) return false

    const int = match[0]
    const start = pos.pos
    pos.pos += int.length
    tokens.push(createToken('int', int, pos, start))
    return true
}

const parseCharLiteral = (chars: string[], tokens: ParseToken[], pos: { pos: number }): boolean => {
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

const parseUnterminatedChar = (chars: string[], tokens: ParseToken[], pos: { pos: number }): void => {
    const quote = `'`
    const start = pos.pos
    pos.pos++
    const char: string[] = []
    while (chars[pos.pos] !== quote) {
        if (isNewline(chars[pos.pos]) || pos.pos === chars.length) {
            pos.pos++
            tokens.push(createToken('unterminated-char', quote + char.join(''), pos, start))
            return
        }
        char.push(chars[pos.pos])
        pos.pos++
    }
}

const parseStringLiteral = (chars: string[], tokens: ParseToken[], pos: { pos: number }): boolean => {
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

const parseUnterminatedString = (chars: string[], tokens: ParseToken[], pos: { pos: number }): void => {
    const quote = '"'
    const start = pos.pos
    pos.pos++
    const str: string[] = []
    while (chars[pos.pos] !== quote) {
        if (isNewline(chars[pos.pos]) || pos.pos === chars.length) {
            tokens.push(createToken('unterminated-string', quote + str.join(''), pos, start))
            return
        }
        str.push(chars[pos.pos])
        pos.pos++
    }
}

const createToken = (
    name: TokenKind,
    value: string, pos: { pos: number },
    start: number = pos.pos
): ParseToken => {
    return { kind: name, value, location: { start, end: pos.pos - 1 } }
}

const isAlpha = (char: string): boolean =>
    (char >= 'A' && char <= 'Z') ||
    (char >= 'a' && char <= 'z') ||
    (char >= 'a' && char <= 'z') ||
    char === '_'

const isNumeric = (char: string): boolean => (char >= '0' && char <= '9')
