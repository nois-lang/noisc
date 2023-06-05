import { tokenize } from './lexer'
import { expect } from '@jest/globals'

describe('lexer', () => {
    it('tokenize basic', () => {
        const code = `\
let main = (): Unit {
	print(4)
}`
        const tokens = tokenize(code)
        expect(tokens.map(t => [t.name, t.value])).toEqual([
            ['let-keyword_', 'let'],
            ['identifier', 'main'],
            ['equals_', '='],
            ['open-paren_', '('],
            ['close-paren_', ')'],
            ['colon_', ':'],
            ['identifier', 'Unit'],
            ['open-brace_', '{'],
            ['identifier', 'print'],
            ['open-paren_', '('],
            ['number', '4'],
            ['close-paren_', ')'],
            ['close-brace_', '}'],
            ['eof', '']
        ])
        expect(tokens.at(0)!.location).toEqual({ start: 0, end: 2 })
        expect(tokens.at(-1)!.location).toEqual({ start: 33, end: 33 })
    })

    it('tokenize number literal simple', () => {
        expect(tokenize('14')).toEqual([
            { name: 'number', value: '14', location: { start: 0, end: 1 } },
            { name: 'eof', value: '', location: { start: 2, end: 2 } }
        ])
    })

    it('tokenize string literal', () => {
        expect(tokenize(`"string 123 \n ok"`)).toEqual([
            { name: 'string', value: `"string 123 \n ok"`, location: { start: 0, end: 16 } },
            { name: 'eof', value: '', location: { start: 17, end: 17 } }
        ])
    })

    it('tokenize char literal', () => {
        expect(tokenize(`'?'`)).toEqual([
            { name: 'char', value: `'?'`, location: { start: 0, end: 2 } },
            { name: 'eof', value: '', location: { start: 3, end: 3 } }
        ])
    })

    it('tokenize expression', () => {
        const tokens = tokenize(`1+call("str").ok() / (12 - a())`)
        expect(tokens.map(t => [t.name, t.value])).toEqual([
            ['number', '1'],
            ['plus', '+'],
            ['identifier', 'call'],
            ['open-paren_', '('],
            ['string', '"str"'],
            ['close-paren_', ')'],
            ['period', '.'],
            ['identifier', 'ok'],
            ['open-paren_', '('],
            ['close-paren_', ')'],
            ['slash', '/'],
            ['open-paren_', '('],
            ['number', '12'],
            ['minus', '-'],
            ['identifier', 'a'],
            ['open-paren_', '('],
            ['close-paren_', ')'],
            ['close-paren_', ')'],
            ['eof', '']
        ])
    })

})
