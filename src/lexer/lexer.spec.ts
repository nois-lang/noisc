import {tokenize} from "./lexer";
import {expect} from "@jest/globals";

describe('lexer', () => {
	it('tokenize', () => {
		const code = `\
fn main(): Unit {
	print(4)
}`
		const tokens = tokenize(code)
		expect(tokens).toEqual([
			{"type": "fn-keyword", "value": "fn"},
			{"type": "identifier", "value": "main"},
			{"type": "open-paren", "value": "("},
			{"type": "close-paren", "value": ")"},
			{"type": "colon", "value": ":"},
			{"type": "identifier", "value": "Unit"},
			{"type": "open-brace", "value": "{"},
			{"type": "identifier", "value": "print"},
			{"type": "open-paren", "value": "("},
			{"type": "number", "value": "4"},
			{"type": "close-paren", "value": ")"},
			{"type": "close-brace", "value": "}"}
		])
	})
})
