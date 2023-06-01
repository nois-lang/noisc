export type TokenType = 'fn-keyword' | 'open-paren' | 'close-paren' | 'identifier' | 'string' | 'char' | 'number'

export interface Token {
    type: TokenType;
    value: string
}

export const constTokenMap: Map<TokenType, Token> = new Map(
    (<Token[]>[
        {type: 'fn-keyword', value: 'fn'},
        {type: 'open-paren', value: '('},
        {type: 'close-paren', value: ')'},
        {type: 'open-brace', value: '{'},
        {type: 'close-brace', value: '}'},
        {type: 'open-angle-bracket', value: '<'},
        {type: 'close-angle-bracket', value: '>'},
        {type: 'colon', value: ':'},
    ]).map(t => [t.type, t])
)

export const tokenize = (code: String): Token[] => {
    const chars = code.split('')
    const tokens: Token[] = []

    while (chars.length !== 0) {
        if (isWhitespace(chars[0])) {
            chars.splice(0, 1)
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
    return tokens
}

const parseIdentifier = (chars: string[], tokens: Token[]): boolean => {
    if (isAlpha(chars[0])) {
        const identifier: string[] = []
        while (isAlpha(chars[0]) || isNumeric(chars[0])) {
            identifier.push(chars[0])
            chars.splice(0, 1)
        }
        tokens.push({type: 'identifier', value: identifier.join('')})
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
const parseNumberLiteral = (chars: string[], tokens: Token[]): boolean => {
    if (isNumeric(chars[0])) {
        const number: string[] = []
        while (isNumeric(chars[0])) {
            number.push(chars[0])
            chars.splice(0, 1)
        }
        // TODO: verify literal
        tokens.push({type: 'number', value: number.join('')})
        return true
    }
    return false
}

const parseCharLiteral = (chars: string[], tokens: Token[]): boolean => {
    // TODO: escape characters
    if (chars[0] === `'`) {
        chars.splice(0, 1)
        const charLiteral: string[] = []
        while (chars[0] !== `'`) {
            charLiteral.push(chars[0])
            chars.splice(0, 1)
        }
        chars.splice(0, 1)
        // TODO: verify literal
        tokens.push({type: 'char', value: charLiteral.join('')})
        return true
    }
    return false
}

const parseStringLiteral = (chars: string[], tokens: Token[]): boolean => {
    // TODO: escape characters
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
        tokens.push({type: 'string', value: stringLiteral.join('')})
        return true
    }
    return false
}

const isWhitespace = (char: string): boolean => char === ' ' || char === '\t' || char === '\n' || char === '\r'

const isAlpha = (char: string): boolean =>
    (char >= 'A' && char <= 'Z') ||
    (char >= 'a' && char <= 'z') ||
    (char >= 'a' && char <= 'z') ||
    char === '_'

const isNumeric = (char: string): boolean => (char >= '0' && char <= '9')
