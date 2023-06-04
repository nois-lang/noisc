import { tokenize } from '../lexer/lexer'
import { expect } from '@jest/globals'
import { compactToken, flattenToken, parse, ParserTokenName, Token } from './parser'

describe('parser', () => {

    const parseToken = (code: string, root: ParserTokenName = 'program'): Token => {
        const tokens = tokenize(code)
        const token = parse(tokens, root)
        if (token === true) {
            throw Error('parsing error: skipped root')
        }
        if ('expect' in token) {
            throw Error(`parsing error: ${token}`)
        }
        return flattenToken(token)
    }

    it('parse basic', () => {
        const code = `let main = (): Unit {}`
        const rule = parseToken(code)
        expect(compactToken(rule!)).toEqual({
            'program': [{
                'statements': [{
                    'statement': [{
                        'variable-def': [{ 'let-keyword': 'let' }, { 'identifier': 'main' }, { 'equals': '=' }, {
                            'expr': [{
                                'operand': [{
                                    'function-expr': [
                                        { 'open-paren': '(' },
                                        { 'close-paren': ')' },
                                        { 'colon': ':' },
                                        { 'type': [{ 'identifier': 'Unit' }] },
                                        { 'block': [{ 'open-brace': '{' }, { 'close-brace': '}' }] }
                                    ]
                                }]
                            }]
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
                {
                    'postfix-op': [{
                        'call-op': [
                            { 'open-paren': '(' },
                            { 'args': [{ 'expr': [{ 'operand': [{ 'number': '12' }] }] }] },
                            { 'close-paren': ')' }
                        ]
                    }]
                }
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
                        { 'open-paren': '(' },
                        { 'close-paren': ')' },
                        { 'colon': ':' },
                        { 'type': [{ 'identifier': 'Unit' }] },
                        { 'block': [{ 'open-brace': '{' }, { 'close-brace': '}' }] }
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
                {
                    'expr': [{ 'operand': [{ 'identifier': 'ok' }] }, {
                        'postfix-op': [{
                            'call-op': [
                                { 'open-paren': '(' },
                                { 'args': [{ 'expr': [{ 'operand': [{ 'number': '4' }] }] }] },
                                { 'close-paren': ')' }
                            ]
                        }]
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
                {
                    'expr': [
                        { 'operand': [{ 'number': '2' }] },
                        { 'infix-operator': [{ 'plus': '+' }] },
                        { 'expr': [{ 'operand': [{ 'number': '3' }] }] }
                    ]
                }
            ]
        })
    })

    it('parse expr parens', () => {
        const rule = parseToken('(foo(12) / 4)', 'expr')
        expect(compactToken(rule!)).toEqual({
            'expr': [{
                'operand': [{ 'open-paren': '(' }, {
                    'expr': [
                        { 'operand': [{ 'identifier': 'foo' }] },
                        {
                            'postfix-op': [{
                                'call-op': [
                                    { 'open-paren': '(' },
                                    { 'args': [{ 'expr': [{ 'operand': [{ 'number': '12' }] }] }] },
                                    { 'close-paren': ')' }
                                ]
                            }]
                        },
                        { 'infix-operator': [{ 'slash': '/' }] },
                        { 'expr': [{ 'operand': [{ 'number': '4' }] }] }
                    ]
                }, { 'close-paren': ')' }]
            }]
        })
    })

    it('parse expr complex', () => {
        const rule = parseToken('(foo(12) / 4) * "str".ok()', 'expr')
        const parenExpr = {
            'operand': [
                { 'open-paren': '(' },
                {
                    'expr': [
                        { 'operand': [{ 'identifier': 'foo' }] },
                        {
                            'postfix-op': [{
                                'call-op': [
                                    { 'open-paren': '(' },
                                    { 'args': [{ 'expr': [{ 'operand': [{ 'number': '12' }] }] }] },
                                    { 'close-paren': ')' }
                                ]
                            }]
                        },
                        { 'infix-operator': [{ 'slash': '/' }] },
                        { 'expr': [{ 'operand': [{ 'number': '4' }] }] }
                    ]
                },
                { 'close-paren': ')' }
            ]
        }
        const methodCallExpr = {
            'expr': [
                { 'operand': [{ 'string': '"str"' }] },
                { 'infix-operator': [{ 'period': '.' }] },
                {
                    'expr': [
                        { 'operand': [{ 'identifier': 'ok' }] },
                        { 'postfix-op': [{ 'call-op': [{ 'open-paren': '(' }, { 'close-paren': ')' }] }] }
                    ]
                }
            ]
        }
        expect(compactToken(rule!)).toEqual({
            'expr': [parenExpr, { 'infix-operator': [{ 'asterisk': '*' }] }, methodCallExpr]
        })
    })

})
