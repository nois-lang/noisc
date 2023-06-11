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
            ['int', '4'],
            ['c-paren', ')'],
            ['newline', '\n'],
            ['c-brace', '}'],
            ['eof', '']
        ])
        expect(tokens.at(0)!.location).toEqual({ start: 0, end: 2 })
        expect(tokens.at(-1)!.location).toEqual({ start: 33, end: 33 })
    })

    describe('tokenize int', () => {
        it('simple', () => {
            expect(tokenize('14 2 0')).toEqual([
                { kind: 'int', value: '14', location: { start: 0, end: 1 } },
                { kind: 'int', value: '2', location: { start: 3, end: 3 } },
                { kind: 'int', value: '0', location: { start: 5, end: 5 } },
                { kind: 'eof', value: '', location: { start: 6, end: 6 } }
            ])
        })
    })

    describe('tokenize float', () => {
        it('simple', () => {
            expect(tokenize('14.0 2.0 0.0')).toEqual([
                { kind: 'float', value: '14.0', location: { start: 0, end: 3 } },
                { kind: 'float', value: '2.0', location: { start: 5, end: 7 } },
                { kind: 'float', value: '0.0', location: { start: 9, end: 11 } },
                { kind: 'eof', value: '', location: { start: 12, end: 12 } }
            ])
        })

        it('shorthand', () => {
            expect(tokenize('14. .0 0. .11')).toEqual([
                { kind: 'float', value: '14.', location: { start: 0, end: 2 } },
                { kind: 'float', value: '.0', location: { start: 4, end: 5 } },
                { kind: 'float', value: '0.', location: { start: 7, end: 8 } },
                { kind: 'float', value: '.11', location: { start: 10, end: 12 } },
                { kind: 'eof', value: '', location: { start: 13, end: 13 } }
            ])
        })

        it('scientific', () => {
            expect(tokenize('1e5 0e2 123.54e-1034')).toEqual([
                { kind: 'float', value: '1e5', location: { start: 0, end: 2 } },
                { kind: 'float', value: '0e2', location: { start: 4, end: 6 } },
                { kind: 'float', value: '123.54e-1034', location: { start: 8, end: 19 } },
                { kind: 'eof', value: '', location: { start: 20, end: 20 } }
            ])
        })
    })

    it('tokenize string literal', () => {
        expect(tokenize(`"string 123 ok"`)).toEqual([
            { kind: 'string', value: `"string 123 ok"`, location: { start: 0, end: 14 } },
            { kind: 'eof', value: '', location: { start: 15, end: 15 } }
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
            ['int', '1'],
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
            ['int', '12'],
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
            { kind: 'int', value: '123', location: { start: 10, end: 12 } },
            { kind: 'eof', value: '', location: { start: 13, end: 13 } }
        ])
    })

    it('tokenize comment', () => {
        expect(tokenize(`//this is 4\n4`)).toEqual([
            { 'kind': 'comment', 'location': { 'end': 10, 'start': 0 }, 'value': '//this is 4' },
            { 'kind': 'newline', 'location': { 'end': 11, 'start': 11 }, 'value': '\n' },
            { 'kind': 'int', 'location': { 'end': 12, 'start': 12 }, 'value': '4' },
            { 'kind': 'eof', 'location': { 'end': 13, 'start': 13 }, 'value': '' }
        ])
    })

})
