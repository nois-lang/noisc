import {tokenize} from './lexer'
import {expect} from '@jest/globals'

describe('lexer', () => {
    it('tokenize basic', () => {
        const code = `\
fn main(): Unit {
	print(4)
}`
        const tokens = tokenize(code)
        expect(tokens).toEqual([
            {'type': 'fn-keyword', 'value': 'fn'},
            {'type': 'identifier', 'value': 'main'},
            {'type': 'open-paren', 'value': '('},
            {'type': 'close-paren', 'value': ')'},
            {'type': 'colon', 'value': ':'},
            {'type': 'identifier', 'value': 'Unit'},
            {'type': 'open-brace', 'value': '{'},
            {'type': 'identifier', 'value': 'print'},
            {'type': 'open-paren', 'value': '('},
            {'type': 'number', 'value': '4'},
            {'type': 'close-paren', 'value': ')'},
            {'type': 'close-brace', 'value': '}'}
        ])
    })

    it('tokenize number literal simple', () => {
        expect(tokenize('14')).toEqual([
            {'type': 'number', 'value': '14'}
        ])
    })

    it('tokenize string literal', () => {
        expect(tokenize(`"string 123 \n ok"`)).toEqual([
            {'type': 'string', 'value': 'string 123 \n ok'}
        ])
    })

    it('tokenize char literal', () => {
        expect(tokenize('\'?\'')).toEqual([
            {'type': 'char', 'value': '?'}
        ])
    })

})
