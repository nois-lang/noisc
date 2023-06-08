import { tokenize } from './lexer'
import { expect } from '@jest/globals'

describe('lexer', () => {

    it('tokenize basic', () => {
        const code = `\
let main = (): Unit {
	print(4)
}`
        const tokens = tokenize(code)
        expect(tokens.map(t => [t.kind, t.value])).toEqual([
            ['let-keyword', 'let'],
            ['identifier', 'main'],
            ['equals', '='],
            ['o-paren', '('],
            ['c-paren', ')'],
            ['colon', ':'],
            ['identifier', 'Unit'],
            ['o-brace', '{'],
            ['newline', '\n'],
            ['identifier', 'print'],
            ['o-paren', '('],
            ['number', '4'],
            ['c-paren', ')'],
            ['newline', '\n'],
            ['c-brace', '}'],
            ['eof', '']
        ])
        expect(tokens.at(0)!.location).toEqual({ start: 0, end: 2 })
        expect(tokens.at(-1)!.location).toEqual({ start: 33, end: 33 })
    })

    it('tokenize number literal simple', () => {
        expect(tokenize('14')).toEqual([
            { kind: 'number', value: '14', location: { start: 0, end: 1 } },
            { kind: 'eof', value: '', location: { start: 2, end: 2 } }
        ])
    })

    it('tokenize string literal', () => {
        expect(tokenize(`"string 123 \n ok"`)).toEqual([
            { kind: 'string', value: `"string 123 \n ok"`, location: { start: 0, end: 16 } },
            { kind: 'eof', value: '', location: { start: 17, end: 17 } }
        ])
    })

    it('tokenize char literal', () => {
        expect(tokenize(`'?'`)).toEqual([
            { kind: 'char', value: `'?'`, location: { start: 0, end: 2 } },
            { kind: 'eof', value: '', location: { start: 3, end: 3 } }
        ])
    })

    it('tokenize expression', () => {
        const tokens = tokenize(`1+call("str").ok() / (12 - a())`)
        expect(tokens.map(t => [t.kind, t.value])).toEqual([
            ['number', '1'],
            ['plus', '+'],
            ['identifier', 'call'],
            ['o-paren', '('],
            ['string', '"str"'],
            ['c-paren', ')'],
            ['period', '.'],
            ['identifier', 'ok'],
            ['o-paren', '('],
            ['c-paren', ')'],
            ['slash', '/'],
            ['o-paren', '('],
            ['number', '12'],
            ['minus', '-'],
            ['identifier', 'a'],
            ['o-paren', '('],
            ['c-paren', ')'],
            ['c-paren', ')'],
            ['eof', '']
        ])
    })

    it('tokenize unknown literal', () => {
        expect(tokenize(`hello ~~~ 123`)).toEqual([
            { kind: 'identifier', value: 'hello', location: { start: 0, end: 4 } },
            { kind: 'unknown', value: '~~~', location: { start: 6, end: 8 } },
            { kind: 'number', value: '123', location: { start: 10, end: 12 } },
            { kind: 'eof', value: '', location: { start: 13, end: 13 } }
        ])
    })

    it('tokenize comment', () => {
        expect(tokenize(`//this is 4\n4`)).toEqual([
            { 'kind': 'comment', 'location': { 'end': 10, 'start': 0 }, 'value': '//this is 4' },
            { 'kind': 'newline', 'location': { 'end': 11, 'start': 11 }, 'value': '\n' },
            { 'kind': 'number', 'location': { 'end': 12, 'start': 12 }, 'value': '4' },
            { 'kind': 'eof', 'location': { 'end': 13, 'start': 13 }, 'value': '' }
        ])
    })

})
