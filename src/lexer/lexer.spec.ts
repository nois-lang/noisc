import { tokenize } from './lexer'

/**
 * Use this command to print lexer output
 * inspect(tokenize(code), { depth: null, compact: true })
 */
describe('lexer', () => {
    it('tokenize basic', () => {
        const code = `\
let main = (): Unit {
	print(4)
}`
        // biome-ignore format: compact
        expect(tokenize(code)).toEqual(
[ { kind: 'let-keyword', value: 'let', span: { start: 0, end: 3 } },
  { kind: 'name', value: 'main', span: { start: 4, end: 8 } },
  { kind: 'equals', value: '=', span: { start: 9, end: 10 } },
  { kind: 'o-paren', value: '(', span: { start: 11, end: 12 } },
  { kind: 'c-paren', value: ')', span: { start: 12, end: 13 } },
  { kind: 'colon', value: ':', span: { start: 13, end: 14 } },
  { kind: 'name', value: 'Unit', span: { start: 15, end: 19 } },
  { kind: 'o-brace', value: '{', span: { start: 20, end: 21 } },
  { kind: 'name', value: 'print', span: { start: 23, end: 28 } },
  { kind: 'o-paren', value: '(', span: { start: 28, end: 29 } },
  { kind: 'int', value: '4', span: { start: 29, end: 30 } },
  { kind: 'c-paren', value: ')', span: { start: 30, end: 31 } },
  { kind: 'c-brace', value: '}', span: { start: 32, end: 33 } },
  { kind: 'eof', value: '', span: { start: 33, end: 34 } } ]
        )
    })

    it('tokenize if', () => {
        const code = `if a { b } else { c }`
        const tokens = tokenize(code)
        // biome-ignore format: compact
        expect(tokens).toEqual(
[ { kind: 'if-keyword', value: 'if', span: { start: 0, end: 2 } },
  { kind: 'name', value: 'a', span: { start: 3, end: 4 } },
  { kind: 'o-brace', value: '{', span: { start: 5, end: 6 } },
  { kind: 'name', value: 'b', span: { start: 7, end: 8 } },
  { kind: 'c-brace', value: '}', span: { start: 9, end: 10 } },
  { kind: 'else-keyword', value: 'else', span: { start: 11, end: 15 } },
  { kind: 'o-brace', value: '{', span: { start: 16, end: 17 } },
  { kind: 'name', value: 'c', span: { start: 18, end: 19 } },
  { kind: 'c-brace', value: '}', span: { start: 20, end: 21 } },
  { kind: 'eof', value: '', span: { start: 21, end: 22 } } ]
        )
    })

    describe('tokenize int', () => {
        it('simple', () => {
            const code = '14 2 0'
            // biome-ignore format: compact
            expect(tokenize(code)).toEqual(
[ { kind: 'int', value: '14', span: { start: 0, end: 2 } },
  { kind: 'int', value: '2', span: { start: 3, end: 4 } },
  { kind: 'int', value: '0', span: { start: 5, end: 6 } },
  { kind: 'eof', value: '', span: { start: 6, end: 7 } } ]
            )
        })
    })

    describe('tokenize float', () => {
        it('simple', () => {
            const code = '14.0 2.0 0.0'
            // biome-ignore format: compact
            expect(tokenize(code)).toEqual(
[ { kind: 'float', value: '14.0', span: { start: 0, end: 4 } },
  { kind: 'float', value: '2.0', span: { start: 5, end: 8 } },
  { kind: 'float', value: '0.0', span: { start: 9, end: 12 } },
  { kind: 'eof', value: '', span: { start: 12, end: 13 } } ]
            )
        })

        it('shorthand', () => {
            const code = '14. .0 0. .11'
            // biome-ignore format: compact
            expect(tokenize(code)).toEqual(
[ { kind: 'float', value: '14.', span: { start: 0, end: 3 } },
  { kind: 'float', value: '.0', span: { start: 4, end: 6 } },
  { kind: 'float', value: '0.', span: { start: 7, end: 9 } },
  { kind: 'float', value: '.11', span: { start: 10, end: 13 } },
  { kind: 'eof', value: '', span: { start: 13, end: 14 } } ]
            )
        })

        it('scientific', () => {
            const code = '1e5 0e2 123.54e-1034'
            // biome-ignore format: compact
            expect(tokenize(code)).toEqual(
[ { kind: 'float', value: '1e5', span: { start: 0, end: 3 } },
  { kind: 'float', value: '0e2', span: { start: 4, end: 7 } },
  { kind: 'float', value: '123.54e-1034', span: { start: 8, end: 20 } },
  { kind: 'eof', value: '', span: { start: 20, end: 21 } } ]
            )
        })
    })

    describe('tokenize char', () => {
        it('plain', () => {
            const code = `'?'`
            // biome-ignore format: compact
            expect(tokenize(code)).toEqual(
[ { kind: 'char', value: "'?'", span: { start: 0, end: 3 } },
  { kind: 'eof', value: '', span: { start: 3, end: 4 } } ]
            )
        })

        it('escape', () => {
            const code = `'\\n''\\r''\\\\'`
            // biome-ignore format: compact
            expect(tokenize(code)).toEqual(
[ { kind: 'char', value: "'\\n'", span: { start: 0, end: 4 } },
  { kind: 'char', value: "'\\r'", span: { start: 4, end: 8 } },
  { kind: 'char', value: "'\\\\'", span: { start: 8, end: 12 } },
  { kind: 'eof', value: '', span: { start: 12, end: 13 } } ]
            )
        })

        it('escape char', () => {
            const code = `'\\''`
            // biome-ignore format: compact
            expect(tokenize(code)).toEqual(
[ { kind: 'char', value: "'\\''", span: { start: 0, end: 4 } },
  { kind: 'eof', value: '', span: { start: 4, end: 5 } } ]
            )
        })

        it('unicode', () => {
            const code = `'\\u{1}' '\\u{ffff}'`
            // biome-ignore format: compact
            expect(tokenize(code)).toEqual(
[ { kind: 'char', value: "'\\u{1}'", span: { start: 0, end: 7 } },
  { kind: 'char', value: "'\\u{ffff}'", span: { start: 8, end: 18 } },
  { kind: 'eof', value: '', span: { start: 18, end: 19 } } ]
            )
        })

        it('unterminated', () => {
            const code = `'h`
            // biome-ignore format: compact
            expect(tokenize(code)).toEqual(
[ { kind: 'char-unterminated', value: "'", span: { start: 0, end: 1 } },
  { kind: 'name', value: 'h', span: { start: 1, end: 2 } },
  { kind: 'eof', value: '', span: { start: 2, end: 3 } } ]
            )
        })

        it('escape newline', () => {
            const code = `'\n'`
            // biome-ignore format: compact
            expect(tokenize(code)).toEqual(
[ { kind: 'char-unterminated', value: "'", span: { start: 0, end: 1 } },
  { kind: 'char-unterminated', value: "'", span: { start: 2, end: 3 } },
  { kind: 'eof', value: '', span: { start: 3, end: 4 } } ]
            )
        })

        it('empty', () => {
            const code = `''`
            // biome-ignore format: compact
            expect(tokenize(code)).toEqual(
[ { kind: 'char-unterminated', value: "''", span: { start: 0, end: 2 } },
  { kind: 'eof', value: '', span: { start: 2, end: 3 } } ]
            )
        })
    })

    describe('tokenize string', () => {
        it('empty', () => {
            const code = `""`
            // biome-ignore format: compact
            expect(tokenize(code)).toEqual(
[ { kind: 'd-quote', value: '"', span: { start: 0, end: 1 } },
  { kind: 'd-quote', value: '"', span: { start: 1, end: 2 } },
  { kind: 'eof', value: '', span: { start: 2, end: 3 } } ]
            )
        })

        it('plain', () => {
            const code = `"string 123 ok"`
            // biome-ignore format: compact
            expect(tokenize(`"string 123 ok"`)).toEqual(
[ { kind: 'd-quote', value: '"', span: { start: 0, end: 1 } },
  { kind: 'string-part', value: 'string 123 ok', span: { start: 1, end: 14 } },
  { kind: 'd-quote', value: '"', span: { start: 14, end: 15 } },
  { kind: 'eof', value: '', span: { start: 15, end: 16 } } ]
            )
        })

        it('escape', () => {
            const code = `"escape\\n \\r \\\\"`
            // biome-ignore format: compact
            expect(tokenize(code)).toEqual(
[ { kind: 'd-quote', value: '"', span: { start: 0, end: 1 } },
  { kind: 'string-part', value: 'escape\\n \\r \\\\', span: { start: 1, end: 15 } },
  { kind: 'd-quote', value: '"', span: { start: 15, end: 16 } },
  { kind: 'eof', value: '', span: { start: 16, end: 17 } } ]
            )
        })

        it('escape string', () => {
            const code = `"\\""`
            // biome-ignore format: compact
            expect(tokenize(code)).toEqual(
[ { kind: 'd-quote', value: '"', span: { start: 0, end: 1 } },
  { kind: 'string-part', value: '\\"', span: { start: 1, end: 3 } },
  { kind: 'd-quote', value: '"', span: { start: 3, end: 4 } },
  { kind: 'eof', value: '', span: { start: 4, end: 5 } } ]
            )
        })

        it('quotes', () => {
            const code = `"quotes '\`\\""`
            // biome-ignore format: compact
            expect(tokenize(code)).toEqual(
[ { kind: 'd-quote', value: '"', span: { start: 0, end: 1 } },
  { kind: 'string-part', value: 'quotes \'`\\"', span: { start: 1, end: 12 } },
  { kind: 'd-quote', value: '"', span: { start: 12, end: 13 } },
  { kind: 'eof', value: '', span: { start: 13, end: 14 } } ]
            )
        })

        it('unicode', () => {
            const code = `"\\u{1} \\u{ffff}"`
            // biome-ignore format: compact
            expect(tokenize(code)).toEqual(
[ { kind: 'd-quote', value: '"', span: { start: 0, end: 1 } },
  { kind: 'string-part', value: '\\u{1} \\u{ffff}', span: { start: 1, end: 15 } },
  { kind: 'd-quote', value: '"', span: { start: 15, end: 16 } },
  { kind: 'eof', value: '', span: { start: 16, end: 17 } } ]
            )
        })

        it('unterminated', () => {
            const code = `"string 123 ok\n`
            // biome-ignore format: compact
            expect(tokenize(code)).toEqual(
[ { kind: 'd-quote', value: '"', span: { start: 0, end: 1 } },
  { kind: 'string-part', value: 'string 123 ok\n', span: { start: 1, end: 15 } },
  { kind: 'eof', value: '', span: { start: 15, end: 16 } } ]
            )
        })

        it('escaped interpolation', () => {
            const code = '"str \\{foo}"'
            // biome-ignore format: compact
            expect(tokenize(code)).toEqual(
[ { kind: 'd-quote', value: '"', span: { start: 0, end: 1 } },
  { kind: 'string-part', value: 'str \\{foo}', span: { start: 1, end: 11 } },
  { kind: 'd-quote', value: '"', span: { start: 11, end: 12 } },
  { kind: 'eof', value: '', span: { start: 12, end: 13 } } ]
            )
        })

        it('interpolation', () => {
            const code = '"{foo}"'
            // biome-ignore format: compact
            expect(tokenize(code)).toEqual(
[ { kind: 'd-quote', value: '"', span: { start: 0, end: 1 } },
  { kind: 'o-brace', value: '{', span: { start: 1, end: 2 } },
  { kind: 'name', value: 'foo', span: { start: 2, end: 5 } },
  { kind: 'c-brace', value: '}', span: { start: 5, end: 6 } },
  { kind: 'd-quote', value: '"', span: { start: 6, end: 7 } },
  { kind: 'eof', value: '', span: { start: 7, end: 8 } } ]
            )
        })

        it('interpolation long', () => {
            const code = '"{foo(5)}"'
            // biome-ignore format: compact
            expect(tokenize(code)).toEqual(
[ { kind: 'd-quote', value: '"', span: { start: 0, end: 1 } },
  { kind: 'o-brace', value: '{', span: { start: 1, end: 2 } },
  { kind: 'name', value: 'foo', span: { start: 2, end: 5 } },
  { kind: 'o-paren', value: '(', span: { start: 5, end: 6 } },
  { kind: 'int', value: '5', span: { start: 6, end: 7 } },
  { kind: 'c-paren', value: ')', span: { start: 7, end: 8 } },
  { kind: 'c-brace', value: '}', span: { start: 8, end: 9 } },
  { kind: 'd-quote', value: '"', span: { start: 9, end: 10 } },
  { kind: 'eof', value: '', span: { start: 10, end: 11 } } ]
            )
        })

        it('interpolation nested', () => {
            const code = '"{foo("str")}aaa"'
            // biome-ignore format: compact
            expect(tokenize(code)).toEqual(
[ { kind: 'd-quote', value: '"', span: { start: 0, end: 1 } },
  { kind: 'o-brace', value: '{', span: { start: 1, end: 2 } },
  { kind: 'name', value: 'foo', span: { start: 2, end: 5 } },
  { kind: 'o-paren', value: '(', span: { start: 5, end: 6 } },
  { kind: 'd-quote', value: '"', span: { start: 6, end: 7 } },
  { kind: 'string-part', value: 'str', span: { start: 7, end: 10 } },
  { kind: 'd-quote', value: '"', span: { start: 10, end: 11 } },
  { kind: 'c-paren', value: ')', span: { start: 11, end: 12 } },
  { kind: 'c-brace', value: '}', span: { start: 12, end: 13 } },
  { kind: 'string-part', value: 'aaa', span: { start: 13, end: 16 } },
  { kind: 'd-quote', value: '"', span: { start: 16, end: 17 } },
  { kind: 'eof', value: '', span: { start: 17, end: 18 } } ]
            )
        })

        it('interpolation nested twice', () => {
            const code = '"{foo("str{5}")}aaa"'
            // biome-ignore format: compact
            expect(tokenize(code)).toEqual(
[ { kind: 'd-quote', value: '"', span: { start: 0, end: 1 } },
  { kind: 'o-brace', value: '{', span: { start: 1, end: 2 } },
  { kind: 'name', value: 'foo', span: { start: 2, end: 5 } },
  { kind: 'o-paren', value: '(', span: { start: 5, end: 6 } },
  { kind: 'd-quote', value: '"', span: { start: 6, end: 7 } },
  { kind: 'string-part', value: 'str', span: { start: 7, end: 10 } },
  { kind: 'o-brace', value: '{', span: { start: 10, end: 11 } },
  { kind: 'int', value: '5', span: { start: 11, end: 12 } },
  { kind: 'c-brace', value: '}', span: { start: 12, end: 13 } },
  { kind: 'd-quote', value: '"', span: { start: 13, end: 14 } },
  { kind: 'c-paren', value: ')', span: { start: 14, end: 15 } },
  { kind: 'c-brace', value: '}', span: { start: 15, end: 16 } },
  { kind: 'string-part', value: 'aaa', span: { start: 16, end: 19 } },
  { kind: 'd-quote', value: '"', span: { start: 19, end: 20 } },
  { kind: 'eof', value: '', span: { start: 20, end: 21 } } ]
            )
        })
    })

    it('tokenize expression', () => {
        const code = `1+call("str").ok() / (12 - a())`
        // biome-ignore format: compact
        expect(tokenize(code)).toEqual(
[ { kind: 'int', value: '1', span: { start: 0, end: 1 } },
  { kind: 'plus', value: '+', span: { start: 1, end: 2 } },
  { kind: 'name', value: 'call', span: { start: 2, end: 6 } },
  { kind: 'o-paren', value: '(', span: { start: 6, end: 7 } },
  { kind: 'd-quote', value: '"', span: { start: 7, end: 8 } },
  { kind: 'string-part', value: 'str', span: { start: 8, end: 11 } },
  { kind: 'd-quote', value: '"', span: { start: 11, end: 12 } },
  { kind: 'c-paren', value: ')', span: { start: 12, end: 13 } },
  { kind: 'period', value: '.', span: { start: 13, end: 14 } },
  { kind: 'name', value: 'ok', span: { start: 14, end: 16 } },
  { kind: 'o-paren', value: '(', span: { start: 16, end: 17 } },
  { kind: 'c-paren', value: ')', span: { start: 17, end: 18 } },
  { kind: 'slash', value: '/', span: { start: 19, end: 20 } },
  { kind: 'o-paren', value: '(', span: { start: 21, end: 22 } },
  { kind: 'int', value: '12', span: { start: 22, end: 24 } },
  { kind: 'minus', value: '-', span: { start: 25, end: 26 } },
  { kind: 'name', value: 'a', span: { start: 27, end: 28 } },
  { kind: 'o-paren', value: '(', span: { start: 28, end: 29 } },
  { kind: 'c-paren', value: ')', span: { start: 29, end: 30 } },
  { kind: 'c-paren', value: ')', span: { start: 30, end: 31 } },
  { kind: 'eof', value: '', span: { start: 31, end: 32 } } ]
        )
    })

    it('tokenize unknown literal', () => {
        const code = `hello ~~~ 123`
        // biome-ignore format: compact
        expect(tokenize(code)).toEqual(
[ { kind: 'name', value: 'hello', span: { start: 0, end: 5 } },
  { kind: 'unknown', value: '~~~', span: { start: 6, end: 9 } },
  { kind: 'int', value: '123', span: { start: 10, end: 13 } },
  { kind: 'eof', value: '', span: { start: 13, end: 14 } } ]
        )
    })

    it('tokenize unknown token', () => {
        const code = `4;`
        // biome-ignore format: compact
        expect(tokenize(code)).toEqual(
[ { kind: 'int', value: '4', span: { start: 0, end: 1 } },
  { kind: 'unknown', value: ';', span: { start: 1, end: 2 } },
  { kind: 'eof', value: '', span: { start: 2, end: 3 } } ]
        )
    })

    it('tokenize comment', () => {
        const code = `//this is 4\n4`
        // biome-ignore format: compact
        expect(tokenize(code)).toEqual(
[ { kind: 'comment', value: '//this is 4', span: { start: 0, end: 11 } },
  { kind: 'int', value: '4', span: { start: 12, end: 13 } },
  { kind: 'eof', value: '', span: { start: 13, end: 14 } } ]
        )
    })
})
