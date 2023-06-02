export type LexerTokenName
    = 'type-keyword'
    | 'fn-keyword'
    | 'kind-keyword'
    | 'impl-keyword'
    | 'let-keyword'
    | 'open-paren'
    | 'close-paren'
    | 'open-bracket'
    | 'close-bracket'
    | 'open-brace'
    | 'close-brace'
    | 'open-chevron'
    | 'close-chevron'
    | 'colon'
    | 'comma'
    | 'period'
    | 'newline'

    | 'eof'
    | '_'

    | 'identifier'
    | 'string'
    | 'char'
    | 'number'

export interface LexerToken {
    name: LexerTokenName
    value: string
}

const constTokens: LexerToken[] = [
    {name: 'type-keyword', value: 'type'},
    {name: 'fn-keyword', value: 'fn'},
    {name: 'kind-keyword', value: 'kind'},
    {name: 'impl-keyword', value: 'impl'},
    {name: 'let-keyword', value: 'let'},
    {name: 'open-paren', value: '('},
    {name: 'close-paren', value: ')'},
    {name: 'open-bracket', value: '['},
    {name: 'close-bracket', value: ']'},
    {name: 'open-brace', value: '{'},
    {name: 'close-brace', value: '}'},
    {name: 'open-chevron', value: '<'},
    {name: 'close-chevron', value: '>'},
    {name: 'colon', value: ':'},
    {name: 'comma', value: ','},
    {name: 'period', value: '.'}
]
export const constTokenMap: Map<LexerTokenName, LexerToken> = new Map(constTokens.map(t => [t.name, t]))

export const tokenize = (code: String): LexerToken[] => {
    const chars = code.split('')
    const tokens: LexerToken[] = []

    while (chars.length !== 0) {
        if (isWhitespace(chars[0])) {
            chars.splice(0, 1)
            continue
        }
        if (isNewline(chars[0])) {
            while (isNewline(chars[0])) {
                chars.splice(0, 1)
            }
            tokens.push({name: 'newline', value: '\n'})
            continue
        }
        let codeLeft = code.slice(code.length - chars.length)
        let constToken = [...constTokenMap.values()].find(v => codeLeft.startsWith(v.value))
        if (constToken) {
            tokens.push(constToken)
            chars.splice(0, constToken.value.length)
            continue
        }
        if (parseIdentifier(chars, tokens)) {
            continue
        }
        if (parseNumberLiteral(chars, tokens)) {
            continue
        }
        if (parseCharLiteral(chars, tokens)) {
            continue
        }
        if (parseStringLiteral(chars, tokens)) {
            continue
        }

        throw Error(`unknown token \`${chars[0]}\``)
    }
    tokens.push({name: 'eof', value: ''})
    return tokens
}

const parseIdentifier = (chars: string[], tokens: LexerToken[]): boolean => {
    if (isAlpha(chars[0])) {
        const identifier: string[] = []
        while (isAlpha(chars[0]) || isNumeric(chars[0])) {
            identifier.push(chars[0])
            chars.splice(0, 1)
        }
        tokens.push({name: 'identifier', value: identifier.join('')})
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
 */
const parseNumberLiteral = (chars: string[], tokens: LexerToken[]): boolean => {
    if (isNumeric(chars[0])) {
        const number: string[] = []
        while (isNumeric(chars[0])) {
            number.push(chars[0])
            chars.splice(0, 1)
        }
        // TODO: verify literal
        tokens.push({name: 'number', value: number.join('')})
        return true
    }
    return false
}

/**
 * TODO: escape characters
 *
 * @param chars
 * @param tokens
 */
const parseCharLiteral = (chars: string[], tokens: LexerToken[]): boolean => {
    if (chars[0] === `'`) {
        chars.splice(0, 1)
        const charLiteral: string[] = []
        while (chars[0] !== `'`) {
            charLiteral.push(chars[0])
            chars.splice(0, 1)
        }
        chars.splice(0, 1)
        // TODO: verify literal
        tokens.push({name: 'char', value: charLiteral.join('')})
        return true
    }
    return false
}

/**
 * TODO: escape characters
 *
 * @param chars
 * @param tokens
 */
const parseStringLiteral = (chars: string[], tokens: LexerToken[]): boolean => {
    if (chars[0] === '"') {
        chars.splice(0, 1)
        const stringLiteral: string[] = []
        while (chars[0] !== '"') {
            if (chars.length === 0) {
                throw Error('no matching `"`')
            }
            stringLiteral.push(chars[0])
            chars.splice(0, 1)
        }
        chars.splice(0, 1)
        // TODO: verify literal
        tokens.push({name: 'string', value: stringLiteral.join('')})
        return true
    }
    return false
}

const isWhitespace = (char: string): boolean => char === ' ' || char === '\t'

const isNewline = (char: string): boolean => char === '\n' || char === '\r'


const isAlpha = (char: string): boolean =>
    (char >= 'A' && char <= 'Z') ||
    (char >= 'a' && char <= 'z') ||
    (char >= 'a' && char <= 'z') ||
    char === '_'

const isNumeric = (char: string): boolean => (char >= '0' && char <= '9')
