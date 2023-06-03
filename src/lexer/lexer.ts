export const lexerTokenNames = <const>[
    // keywords
    'type-keyword',
    'fn-keyword',
    'kind-keyword',
    'impl-keyword',
    'const-keyword',

    // punctuation & operators
    'open-paren',
    'close-paren',
    'open-bracket',
    'close-bracket',
    'open-brace',
    'close-brace',
    'open-chevron',
    'close-chevron',
    'colon',
    'comma',
    'period',
    'equals',

    'plus',
    'minus',
    'asterisk',
    'slash',
    'caret',
    'percent',
    'not-equals',
    'greater-eq',
    'open-chevron',
    'less-eq',
    'and',
    'or',
    'excl',
    'spread',

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
    location: TokenLocation
}

export interface TokenLocation {
    start: number
    end: number
}


export const constTokenMap: Map<LexerTokenName, string> = new Map([
    ['type-keyword', 'type'],
    ['fn-keyword', 'fn'],
    ['kind-keyword', 'kind'],
    ['impl-keyword', 'impl'],
    ['const-keyword', 'const'],
    ['open-paren', '('],
    ['close-paren', ')'],
    ['open-bracket', '['],
    ['close-bracket', ']'],
    ['open-brace', '{'],
    ['close-brace', '}'],
    ['open-chevron', '<'],
    ['close-chevron', '>'],
    ['colon', ':'],
    ['comma', ','],
    ['period', '.'],
    ['equals', '=']
])

export const tokenize = (code: String): LexerToken[] => {
    const pos = { pos: 0 }
    const chars = code.split('')
    const tokens: LexerToken[] = []

    while (pos.pos < chars.length) {
        if (isWhitespace(chars[pos.pos]) || isNewline(chars[pos.pos])) {
            pos.pos++
            continue
        }
        let codeLeft = code.slice(pos.pos)
        let pair = [...constTokenMap.entries()].find(([, v]) => codeLeft.startsWith(v))
        if (pair) {
            const [name, value] = pair
            const start = pos.pos
            pos.pos += value.length
            tokens.push(createToken(name, value, pos, start))
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
    if (chars[pos.pos] === `'`) {
        const start = pos.pos
        pos.pos++
        const charLiteral: string[] = []
        while (chars[pos.pos] !== `'`) {
            charLiteral.push(chars[pos.pos])
            pos.pos++
        }
        pos.pos++
        // TODO: verify literal
        tokens.push(createToken('char', charLiteral.join(''), pos, start))
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
    if (chars[pos.pos] === '"') {
        const start = pos.pos
        pos.pos++
        const stringLiteral: string[] = []
        while (chars[pos.pos] !== '"') {
            if (chars.length === pos.pos) {
                throw Error('no matching `"`')
            }
            stringLiteral.push(chars[pos.pos])
            pos.pos++
        }
        pos.pos++
        // TODO: verify literal
        tokens.push(createToken('string', stringLiteral.join(''), pos, start))
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

const isWhitespace = (char: string): boolean => char === ' ' || char === '\t'

const isNewline = (char: string): boolean => char === '\n' || char === '\r'


const isAlpha = (char: string): boolean =>
    (char >= 'A' && char <= 'Z') ||
    (char >= 'a' && char <= 'z') ||
    (char >= 'a' && char <= 'z') ||
    char === '_'

const isNumeric = (char: string): boolean => (char >= '0' && char <= '9')
