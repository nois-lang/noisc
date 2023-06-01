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
		let char = chars[0]
		let codeLeft = code.slice(code.length - chars.length);

		if (isWhitespace(char)) {
			chars.splice(0, 1)
			continue
		}

		let constToken = [...constTokenMap.values()].find(v => codeLeft.startsWith(v.value));
		if (constToken) {
			tokens.push(constToken)
			chars.splice(0, constToken.value.length)
			continue
		}

		if (isAlpha(char)) {
			const identifier: string[] = []
			while (isAlpha(chars[0]) || isNumeric(chars[0])) {
				identifier.push(chars[0])
				chars.splice(0, 1)
			}
			tokens.push({type: 'identifier', value: identifier.join('')})
			continue
		}

		if (isNumeric(char)) {
			const number: string[] = []
			while (isNumeric(chars[0])) {
				number.push(chars[0])
				chars.splice(0, 1)
			}
			// TODO: verify literal
			tokens.push({type: 'number', value: number.join('')})
			continue
		}

		// TODO: escape characters
		if (char === `'`) {
			chars.splice(0, 1)
			const charLiteral: string[] = []
			while (chars[0] !== `'`) {
				charLiteral.push(char)
				chars.splice(0, 1)
			}
			// TODO: verify literal
			tokens.push({type: 'char', value: charLiteral.join('')})
			continue
		}

		// TODO: escape characters
		if (char === '"') {
			chars.splice(0, 1)
			const stringLiteral: string[] = []
			while (chars[0] !== '"') {
				stringLiteral.push(char)
				chars.splice(0, 1)
			}
			// TODO: verify literal
			tokens.push({type: 'string', value: stringLiteral.join('')})
			continue
		}

		throw Error(`unknown token \`${char}\``)
	}
	return tokens
}

const isWhitespace = (char: string): boolean => char === ' ' || char === '\t' || char === '\n' || char === '\r'

const isAlpha = (char: string): boolean =>
	(char >= 'A' && char <= 'Z') ||
	(char >= 'a' && char <= 'z') ||
	(char >= 'a' && char <= 'z') ||
	char === '_'

const isNumeric = (char: string): boolean => (char >= '0' && char <= '9')
