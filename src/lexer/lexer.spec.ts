import { tokenize } from './lexer'

describe('lexer', () => {
    it('tokenize basic', () => {
        const code = `\
let main = (): Unit {
	print(4)
}`
        const tokens = tokenize(code)
        expect(tokens.map(t => [t.kind, t.value])).toEqual([
            ['let-keyword', 'let'],
            ['name', 'main'],
            ['equals', '='],
            ['o-paren', '('],
            ['c-paren', ')'],
            ['colon', ':'],
            ['name', 'Unit'],
            ['o-brace', '{'],
            ['newline', '\n'],
            ['name', 'print'],
            ['o-paren', '('],
            ['int', '4'],
            ['c-paren', ')'],
            ['newline', '\n'],
            ['c-brace', '}'],
            ['eof', '']
        ])
        expect(tokens.at(0)!.span).toEqual({ start: 0, end: 3 })
        expect(tokens.at(-1)!.span).toEqual({ start: 33, end: 34 })
    })

    describe('tokenize int', () => {
        it('simple', () => {
            expect(tokenize('14 2 0')).toEqual([
                { kind: 'int', value: '14', span: { start: 0, end: 2 } },
                { kind: 'int', value: '2', span: { start: 3, end: 4 } },
                { kind: 'int', value: '0', span: { start: 5, end: 6 } },
                { kind: 'eof', value: '', span: { start: 6, end: 7 } }
            ])
        })
    })

    describe('tokenize float', () => {
        it('simple', () => {
            expect(tokenize('14.0 2.0 0.0')).toEqual([
                { kind: 'float', value: '14.0', span: { start: 0, end: 4 } },
                { kind: 'float', value: '2.0', span: { start: 5, end: 8 } },
                { kind: 'float', value: '0.0', span: { start: 9, end: 12 } },
                { kind: 'eof', value: '', span: { start: 12, end: 13 } }
            ])
        })

        it('shorthand', () => {
            expect(tokenize('14. .0 0. .11')).toEqual([
                { kind: 'float', value: '14.', span: { start: 0, end: 3 } },
                { kind: 'float', value: '.0', span: { start: 4, end: 6 } },
                { kind: 'float', value: '0.', span: { start: 7, end: 9 } },
                { kind: 'float', value: '.11', span: { start: 10, end: 13 } },
                { kind: 'eof', value: '', span: { start: 13, end: 14 } }
            ])
        })

        it('scientific', () => {
            expect(tokenize('1e5 0e2 123.54e-1034')).toEqual([
                { kind: 'float', value: '1e5', span: { start: 0, end: 3 } },
                { kind: 'float', value: '0e2', span: { start: 4, end: 7 } },
                { kind: 'float', value: '123.54e-1034', span: { start: 8, end: 20 } },
                { kind: 'eof', value: '', span: { start: 20, end: 21 } }
            ])
        })
    })

    describe('tokenize char', () => {
        it('plain', () => {
            expect(tokenize(`'?'`)).toEqual([
                { kind: 'char', value: `'?'`, span: { start: 0, end: 3 } },
                { kind: 'eof', value: '', span: { start: 3, end: 4 } }
            ])
        })

        it('escape', () => {
            expect(tokenize(`'\\n''\\r''\\\\'`)).toEqual([
                { kind: 'char', span: { end: 4, start: 0 }, value: "'\\n'" },
                { kind: 'char', span: { end: 8, start: 4 }, value: "'\\r'" },
                { kind: 'char', span: { end: 12, start: 8 }, value: "'\\\\'" },
                { kind: 'eof', span: { end: 13, start: 12 }, value: '' }
            ])
        })

        it('escape char', () => {
            expect(tokenize(`'\\''`)).toEqual([
                { kind: 'char', value: `'\\''`, span: { start: 0, end: 4 } },
                { kind: 'eof', value: '', span: { start: 4, end: 5 } }
            ])
        })

        it('unicode', () => {
            expect(tokenize(`'\\u{1}' '\\u{ffff}'`)).toEqual([
                { kind: 'char', value: `'\\u{1}'`, span: { start: 0, end: 7 } },
                { kind: 'char', value: `'\\u{ffff}'`, span: { start: 8, end: 18 } },
                { kind: 'eof', value: '', span: { start: 18, end: 19 } }
            ])
        })

        it('unterminated', () => {
            expect(tokenize(`'h`)).toEqual([
                { kind: 'unterminated-char', value: `'h`, span: { start: 0, end: 2 } },
                { kind: 'eof', value: '', span: { start: 2, end: 3 } }
            ])
        })

        it('empty', () => {
            expect(tokenize(`''`)).toEqual([
                { kind: 'unterminated-char', value: `''`, span: { start: 0, end: 2 } },
                { kind: 'eof', value: '', span: { start: 2, end: 3 } }
            ])
        })
    })

    describe('tokenize string', () => {
        it('empty', () => {
            expect(tokenize(`""`)).toEqual([
                { kind: 'string', value: `""`, span: { start: 0, end: 2 } },
                { kind: 'eof', value: '', span: { start: 2, end: 3 } }
            ])
        })

        it('plain', () => {
            expect(tokenize(`"string 123 ok"`)).toEqual([
                { kind: 'string', value: `"string 123 ok"`, span: { start: 0, end: 15 } },
                { kind: 'eof', value: '', span: { start: 15, end: 16 } }
            ])
        })

        it('escape', () => {
            expect(tokenize(`"escape\\n \\r \\\\"`)).toEqual([
                { kind: 'string', value: `"escape\\n \\r \\\\"`, span: { start: 0, end: 16 } },
                { kind: 'eof', value: '', span: { start: 16, end: 17 } }
            ])
        })

        it('escape string', () => {
            expect(tokenize(`"\\""`)).toEqual([
                { kind: 'string', value: `"\\""`, span: { start: 0, end: 4 } },
                { kind: 'eof', value: '', span: { start: 4, end: 5 } }
            ])
        })

        it('quotes', () => {
            expect(tokenize(`"quotes '\`\\""`)).toEqual([
                { kind: 'string', value: `"quotes '\`\\""`, span: { start: 0, end: 13 } },
                { kind: 'eof', value: '', span: { start: 13, end: 14 } }
            ])
        })

        it('unicode', () => {
            expect(tokenize(`"\\u{1} \\u{ffff}"`)).toEqual([
                { kind: 'string', value: `"\\u{1} \\u{ffff}"`, span: { start: 0, end: 16 } },
                { kind: 'eof', value: '', span: { start: 16, end: 17 } }
            ])
        })

        it('unterminated', () => {
            expect(tokenize(`"string 123 ok\n`)).toEqual([
                { kind: 'unterminated-string', value: `"string 123 ok`, span: { start: 0, end: 14 } },
                { kind: 'newline', value: `\n`, span: { start: 14, end: 15 } },
                { kind: 'eof', value: '', span: { start: 15, end: 16 } }
            ])
        })
    })

    it('tokenize expression', () => {
        const tokens = tokenize(`1+call("str").ok() / (12 - a())`)
        expect(tokens.map(t => [t.kind, t.value])).toEqual([
            ['int', '1'],
            ['plus', '+'],
            ['name', 'call'],
            ['o-paren', '('],
            ['string', '"str"'],
            ['c-paren', ')'],
            ['period', '.'],
            ['name', 'ok'],
            ['o-paren', '('],
            ['c-paren', ')'],
            ['slash', '/'],
            ['o-paren', '('],
            ['int', '12'],
            ['minus', '-'],
            ['name', 'a'],
            ['o-paren', '('],
            ['c-paren', ')'],
            ['c-paren', ')'],
            ['eof', '']
        ])
    })

    it('tokenize unknown literal', () => {
        expect(tokenize(`hello ~~~ 123`)).toEqual([
            { kind: 'name', value: 'hello', span: { start: 0, end: 5 } },
            { kind: 'unknown', value: '~~~', span: { start: 6, end: 9 } },
            { kind: 'int', value: '123', span: { start: 10, end: 13 } },
            { kind: 'eof', value: '', span: { start: 13, end: 14 } }
        ])
    })

    it('tokenize unknown token', () => {
        expect(tokenize(`4;`)).toEqual([
            { kind: 'int', value: '4', span: { start: 0, end: 1 } },
            { kind: 'unknown', value: ';', span: { start: 1, end: 2 } },
            { kind: 'eof', value: '', span: { start: 2, end: 3 } }
        ])
    })

    it('tokenize comment', () => {
        expect(tokenize(`//this is 4\n4`)).toEqual([
            { kind: 'comment', span: { start: 0, end: 11 }, value: '//this is 4' },
            { kind: 'newline', span: { start: 11, end: 12 }, value: '\n' },
            { kind: 'int', span: { start: 12, end: 13 }, value: '4' },
            { kind: 'eof', span: { start: 13, end: 14 }, value: '' }
        ])
    })
})
