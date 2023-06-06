import { tokenize } from '../lexer/lexer'
import { expect } from '@jest/globals'
import { compactToken, flattenToken, parse, ParserTokenName, Token } from './parser'
import { prettyLexerError, prettySyntaxError } from '../error'

describe('parser', () => {

    const parseToken = (source: string, root: ParserTokenName = 'program'): Token => {
        const tokens = tokenize(source)
        if ('name' in tokens) {
            throw Error(prettyLexerError(tokens))
        }
        const token = parse(tokens, root)
        if ('expected' in token) {
            throw Error(prettySyntaxError(token))
        }
        return flattenToken(token)
    }

    it('parse basic', () => {
        const code = `let main = (): Unit {}`
        const rule = parseToken(code)
        expect(compactToken(rule!)).toEqual({
            'program': [{
                'statement': [{
                    'variable-def': [{ 'identifier': 'main' }, {
                        'expr': [{
                            'operand': [{
                                'function-expr': [
                                    { 'params': [] },
                                    { 'type': [{ 'identifier': 'Unit' }] },
                                    { 'block': [] }]
                            }
                            ]
                        }]
                    }]
                }]
            }]
        })
    })

    it('parse unary-expr', () => {
        const rule = parseToken('-3', 'expr')
        expect(compactToken(rule!)).toEqual({
            'expr': [
                { 'prefix-op': [{ 'minus': '-' }] },
                { 'operand': [{ 'number': '3' }] }
            ]
        })
    })

    it('parse function call', () => {
        const rule = parseToken('foo(12)', 'expr')
        expect(compactToken(rule!)).toEqual({
            'expr': [
                { 'operand': [{ 'identifier': 'foo' }] },
                { 'postfix-op': [{ 'call-op': [{ 'args': [{ 'expr': [{ 'operand': [{ 'number': '12' }] }] }] }] }] }
            ]
        })
    })

    it('parse function-expr', () => {
        const code = `(): Unit {}`
        const rule = parseToken(code, 'expr')
        expect(compactToken(rule!)).toEqual({
            'expr': [{
                'operand': [{
                    'function-expr': [
                        { 'params': [] },
                        { 'type': [{ 'identifier': 'Unit' }] },
                        { 'block': [] }
                    ]
                }]
            }]
        })
    })

    it('parse method call', () => {
        const rule = parseToken('"str".ok(4)', 'expr')
        expect(compactToken(rule!)).toEqual({
            'expr': [
                { 'operand': [{ 'string': '"str"' }] },
                { 'infix-operator': [{ 'period': '.' }] },
                { 'operand': [{ 'identifier': 'ok' }] },
                {
                    'postfix-op': [{
                        'call-op': [{ 'args': [{ 'expr': [{ 'operand': [{ 'number': '4' }] }] }] },]
                    }]
                }
            ]
        })
    })

    it('parse expr continuous', () => {
        const rule = parseToken('1 + 2 + 3', 'expr')
        expect(compactToken(rule!)).toEqual({
            'expr': [
                { 'operand': [{ 'number': '1' }] },
                { 'infix-operator': [{ 'plus': '+' }] },
                { 'operand': [{ 'number': '2' }] },
                { 'infix-operator': [{ 'plus': '+' }] },
                { 'operand': [{ 'number': '3' }] }
            ]
        })
    })

    it('parse expr parens', () => {
        const rule = parseToken('(foo(12) / 4)', 'expr')
        expect(compactToken(rule!)).toEqual({
            'expr': [{
                'operand': [{
                    'expr': [
                        { 'operand': [{ 'identifier': 'foo' }] },
                        {
                            'postfix-op': [{
                                'call-op': [
                                    { 'args': [{ 'expr': [{ 'operand': [{ 'number': '12' }] }] }] },
                                ]
                            }]
                        },
                        { 'infix-operator': [{ 'slash': '/' }] },
                        { 'operand': [{ 'number': '4' }] }
                    ]
                }]
            }]
        })
    })

    it('parse expr complex', () => {
        const rule = parseToken('(foo(12) / 4) * "str".ok()', 'expr')
        const parenExpr = {
            'operand': [
                {
                    'expr': [
                        { 'operand': [{ 'identifier': 'foo' }] },
                        {
                            'postfix-op': [{
                                'call-op': [
                                    { 'args': [{ 'expr': [{ 'operand': [{ 'number': '12' }] }] }] },
                                ]
                            }]
                        },
                        { 'infix-operator': [{ 'slash': '/' }] },
                        { 'operand': [{ 'number': '4' }] }
                    ]
                },
            ]
        }
        expect(compactToken(rule!)).toEqual({
            'expr': [
                parenExpr,
                { 'infix-operator': [{ 'asterisk': '*' }] },
                { 'operand': [{ 'string': '"str"' }] },
                { 'infix-operator': [{ 'period': '.' }] },
                { 'operand': [{ 'identifier': 'ok' }] },
                { 'postfix-op': [{ 'call-op': [{ 'args': [] }] }] }
            ]
        })
    })

    it('parse args', () => {
        const rule = parseToken('(a: Int, b: Int, c: Option<String>): Unit {}', 'expr')
        expect(compactToken(rule!)).toEqual({
            'expr': [{
                'operand': [{
                    'function-expr': [
                        {
                            'params': [
                                { 'param': [{ 'identifier': 'a' }, { 'type': [{ 'identifier': 'Int' }] }] },
                                { 'param': [{ 'identifier': 'b' }, { 'type': [{ 'identifier': 'Int' }] }] },
                                {
                                    'param': [
                                        { 'identifier': 'c' },
                                        {
                                            'type': [
                                                { 'identifier': 'Option' },
                                                { 'type-params': [{ 'type': [{ 'identifier': 'String' }] }] },
                                            ]
                                        }
                                    ]
                                }]
                        },
                        { 'type': [{ 'identifier': 'Unit' }] },
                        { 'block': [] }
                    ]
                }]
            }]
        })
    })

    it('parse if-expr', () => {
        const rule = parseToken('if 4 == 4 {a} else {b}', 'expr')
        expect(compactToken(rule!)).toEqual({
            'expr': [{
                'operand': [{
                    'if-expr': [
                        {
                            'expr': [
                                { 'operand': [{ 'number': '4' }] },
                                { 'infix-operator': [{ 'equals-op': '==' }] },
                                { 'operand': [{ 'number': '4' }] }
                            ]
                        },
                        { 'block': [{ 'statement': [{ 'expr': [{ 'operand': [{ 'identifier': 'a' }] }] }] },] },
                        {
                            'block': [
                                { 'statement': [{ 'expr': [{ 'operand': [{ 'identifier': 'b' }] }] }] },
                            ]
                        }
                    ]
                }]
            }]
        })
    })

})
