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
            {'name': 'fn-keyword', 'value': 'fn'},
            {'name': 'identifier', 'value': 'main'},
            {'name': 'open-paren', 'value': '('},
            {'name': 'close-paren', 'value': ')'},
            {'name': 'colon', 'value': ':'},
            {'name': 'identifier', 'value': 'Unit'},
            {'name': 'open-brace', 'value': '{'},
            {'name': 'identifier', 'value': 'print'},
            {'name': 'open-paren', 'value': '('},
            {'name': 'number', 'value': '4'},
            {'name': 'close-paren', 'value': ')'},
            {'name': 'close-brace', 'value': '}'},
            {'name': 'eof', 'value': ''}
        ])
    })

    it('tokenize number literal simple', () => {
        expect(tokenize('14')).toEqual([
            {'name': 'number', 'value': '14'},
            {'name': 'eof', 'value': ''}
        ])
    })

    it('tokenize string literal', () => {
        expect(tokenize(`"string 123 \n ok"`)).toEqual([
            {'name': 'string', 'value': 'string 123 \n ok'},
            {'name': 'eof', 'value': ''}
        ])
    })

    it('tokenize char literal', () => {
        expect(tokenize('\'?\'')).toEqual([
            {'name': 'char', 'value': '?'},
            {'name': 'eof', 'value': ''}
        ])
    })

})
