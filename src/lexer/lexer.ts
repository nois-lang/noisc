import { LocationRange } from '../location'

export const lexerTokenNames = <const>[
    // keywords
    'type-keyword',
    'kind-keyword',
    'impl-keyword',
    'let-keyword',
    'if-keyword',
    'else-keyword',
    'return-keyword',

    // punctuation & operators
    'open-paren',
    'close-paren',
    'open-bracket',
    'close-bracket',
    'open-brace',
    'close-brace',
    'open-chevron',
    'close-chevron',

    'plus',
    'minus',
    'asterisk',
    'slash',
    'caret',
    'percent',
    'equals-op',
    'not-equals-op',
    'greater-eq',
    'open-chevron',
    'less-eq',
    'and',
    'or',
    'excl',
    'spread',

    'colon',
    'comma',
    'period',
    'equals',

    // dynamic
    'identifier',
    'string',
    'char',
    'number',

    // special
    'eof',
    'e',
]
export type LexerTokenName = typeof lexerTokenNames[number]

export interface LexerToken {
    name: LexerTokenName
    value: string
    location: LocationRange
}

export const constTokenMap: Map<LexerTokenName, string> = new Map([
    ['type-keyword', 'type'],
    ['kind-keyword', 'kind'],
    ['if-keyword', 'if'],
    ['else-keyword', 'else'],
    ['return-keyword', 'return'],
    ['impl-keyword', 'impl'],
    ['let-keyword', 'let'],
    ['open-paren', '('],
    ['close-paren', ')'],
    ['open-bracket', '['],
    ['close-bracket', ']'],
    ['open-brace', '{'],
    ['close-brace', '}'],
    ['open-chevron', '<'],
    ['close-chevron', '>'],

    ['equals-op', '=='],
    ['plus', '+'],
    ['minus', '-'],
    ['asterisk', '*'],
    ['slash', '/'],
    ['caret', '^'],
    ['percent', '%'],
    ['not-equals-op', '!='],
    ['greater-eq', '>='],
    ['less-eq', '<='],
    ['and', '&&'],
    ['or', '||'],
    ['excl', '!'],
    ['spread', '..'],

    ['colon', ':'],
    ['comma', ','],
    ['period', '.'],
    ['equals', '='],
])

export const isWhitespace = (char: string): boolean => char === ' ' || char === '\t'

export const isNewline = (char: string): boolean => char === '\n' || char === '\r'

export const tokenize = (code: String): LexerToken[] => {
    const pos = { pos: 0 }
    const chars = code.split('')
    const tokens: LexerToken[] = []

    while (pos.pos < chars.length) {
        if (isWhitespace(chars[pos.pos]) || isNewline(chars[pos.pos])) {
            pos.pos++
            continue
        }
        if (parseConstToken(chars, tokens, pos)) {
            continue
        }
        if (parseIdentifier(chars, tokens, pos)) {
            continue
        }
        if (parseNumberLiteral(chars, tokens, pos)) {
            continue
        }
        if (parseCharLiteral(chars, tokens, pos)) {
            continue
        }
        if (parseStringLiteral(chars, tokens, pos)) {
            continue
        }
        throw Error(`unknown token \`${chars[pos.pos]}\``)
    }

    pos.pos++
    tokens.push(createToken('eof', '', pos))

    return tokens
}

const parseConstToken = (chars: string[], tokens: LexerToken[], pos: { pos: number }): boolean => {
    let codeLeft = chars.slice(pos.pos).join('')
    let pair = [...constTokenMap.entries()].find(([, v]) => codeLeft.startsWith(v))
    if (pair) {
        const [name, value] = pair
        const start = pos.pos
        pos.pos += value.length
        tokens.push(createToken(name, value, pos, start))
        return true
    }
    return false
}

const parseIdentifier = (chars: string[], tokens: LexerToken[], pos: { pos: number }): boolean => {
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
const parseNumberLiteral = (chars: string[], tokens: LexerToken[], pos: { pos: number }): boolean => {
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
const parseCharLiteral = (chars: string[], tokens: LexerToken[], pos: { pos: number }): boolean => {
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
const parseStringLiteral = (chars: string[], tokens: LexerToken[], pos: { pos: number }): boolean => {
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
    name: LexerTokenName,
    value: string, pos: { pos: number },
    start: number = pos.pos - 1
): LexerToken => {
    return { name, value, location: { start, end: pos.pos - 1 } }
}

const isAlpha = (char: string): boolean =>
    (char >= 'A' && char <= 'Z') ||
    (char >= 'a' && char <= 'z') ||
    (char >= 'a' && char <= 'z') ||
    char === '_'

const isNumeric = (char: string): boolean => (char >= '0' && char <= '9')
