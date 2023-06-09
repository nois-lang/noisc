import { LocationRange } from '../location'

export const lexerTokenKinds = <const>[
    // keywords
    'type-keyword',
    'kind-keyword',
    'impl-keyword',
    'let-keyword',
    'fn-keyword',
    'if-keyword',
    'else-keyword',
    'return-keyword',

    // punctuation
    'o-paren',
    'c-paren',
    'o-bracket',
    'c-bracket',
    'o-brace',
    'c-brace',
    'o-angle',
    'c-angle',
    'colon',
    'semi',
    'comma',
    'equals',
    'underscore',

    // operators
    'plus',
    'minus',
    'asterisk',
    'slash',
    'caret',
    'percent',
    'ampersand',
    'pipe',
    'excl',
    'period',

    // dynamic
    'identifier',
    'string',
    'char',
    'number',

    // parse independent
    'newline',
    'comment',

    // special
    'unknown',
    'eof'
]
export type TokenKind = typeof lexerTokenKinds[number]

export interface ParseToken {
    kind: TokenKind
    value: string
    location: LocationRange
}

export const constTokenKindMap: Map<TokenKind, string> = new Map([
    ['type-keyword', 'type'],
    ['kind-keyword', 'kind'],
    ['if-keyword', 'if'],
    ['else-keyword', 'else'],
    ['return-keyword', 'return'],
    ['impl-keyword', 'impl'],
    ['let-keyword', 'let'],
    ['fn-keyword', 'fn'],

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
    ['period', '.'],

    ['colon', ':'],
    ['semi', ';'],
    ['comma', ','],
    ['equals', '='],
    ['underscore', '_'],
])

/**
 * Independent tokens are automatically advanced by parser by default
 */
export const independentTokenKinds: TokenKind[] = ['newline', 'comment']

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

        const fns = [parseComment, parseNewline, parseConstToken, parseIdentifier, parseNumberLiteral, parseCharLiteral,
            parseStringLiteral]

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
    let pair = [...constTokenKindMap.entries()].find(([, v]) => codeLeft.startsWith(v))
    if (pair) {
        const [kind, value] = pair
        const start = pos.pos
        pos.pos += value.length
        tokens.push(createToken(kind, value, pos, start))
        return true
    }
    return false
}

const parseIdentifier = (chars: string[], tokens: ParseToken[], pos: { pos: number }): boolean => {
    if (isAlpha(chars[pos.pos])) {
        const start = pos.pos
        const identifier: string[] = []
        while (isAlpha(chars[pos.pos]) || isNumeric(chars[pos.pos])) {
            identifier.push(chars[pos.pos])
            pos.pos++
        }
        tokens.push(createToken('identifier', identifier.join(''), pos, start))
        return true
    }
    return false
}

/**
 *
 * TODO: floats
 * TODO: sign
 * TODO: scientific notation
 *
 * @param chars
 * @param tokens
 * @param pos
 */
const parseNumberLiteral = (chars: string[], tokens: ParseToken[], pos: { pos: number }): boolean => {
    if (isNumeric(chars[pos.pos])) {
        const start = pos.pos
        const number: string[] = []
        while (isNumeric(chars[pos.pos])) {
            number.push(chars[pos.pos])
            pos.pos++
        }
        // TODO: verify literal
        tokens.push(createToken('number', number.join(''), pos, start))
        return true
    }
    return false
}

/**
 * TODO: escape characters
 *
 * @param chars
 * @param tokens
 * @param pos
 */
const parseCharLiteral = (chars: string[], tokens: ParseToken[], pos: { pos: number }): boolean => {
    const quote = `'`
    if (chars[pos.pos] === quote) {
        const start = pos.pos
        pos.pos++
        const charLiteral: string[] = []
        while (chars[pos.pos] !== quote) {
            charLiteral.push(chars[pos.pos])
            pos.pos++
        }
        pos.pos++
        // TODO: verify literal
        tokens.push(createToken('char', quote + charLiteral.join('') + quote, pos, start))
        return true
    }
    return false
}

/**
 * TODO: escape characters
 *
 * @param chars
 * @param tokens
 * @param pos
 */
const parseStringLiteral = (chars: string[], tokens: ParseToken[], pos: { pos: number }): boolean => {
    const quote = '"'
    if (chars[pos.pos] === quote) {
        const start = pos.pos
        pos.pos++
        const stringLiteral: string[] = []
        while (chars[pos.pos] !== quote) {
            if (chars.length === pos.pos) {
                throw Error(`no matching \`${quote}\``)
            }
            stringLiteral.push(chars[pos.pos])
            pos.pos++
        }
        pos.pos++
        // TODO: verify literal
        tokens.push(createToken('string', quote + stringLiteral.join('') + quote, pos, start))
        return true
    }
    return false
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
    char === ''

const isNumeric = (char: string): boolean => (char >= '0' && char <= '9')
