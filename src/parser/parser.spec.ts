import { tokenize } from '../lexer/lexer'
import { expect } from '@jest/globals'
import { compactToken, flattenToken, parse, ParserTokenName, Token } from './parser'

describe('parser', () => {

    const parseToken = (code: string, root: ParserTokenName = 'program'): Token => {
        const tokens = tokenize(code)
        const token = parse(tokens, root)
        if (typeof token === 'boolean') {
            throw Error('parsing error')
        }
        return flattenToken(token)
    }

    it('parse basic', () => {
        const code = `let main = (): Unit {}`
        const rule = parseToken(code)
        expect(compactToken(rule!)).toEqual({
            'name': 'program',
            'nodes': [{
                'name': 'statements',
                'nodes': [{
                    'name': 'statement',
                    'nodes': [{
                        'name': 'variable-def',
                        'nodes': [
                            { 'name': 'let-keyword', 'value': 'let' },
                            { 'name': 'identifier', 'value': 'main' },
                            { 'name': 'equals', 'value': '=' },
                            {
                                'name': 'expr',
                                'nodes': [{
                                    'name': 'operand',
                                    'nodes': [{
                                        'name': 'function-expr',
                                        'nodes': [
                                            { 'name': 'open-paren', 'value': '(' },
                                            { 'name': 'close-paren', 'value': ')' },
                                            { 'name': 'colon', 'value': ':' },
                                            {
                                                'name': 'type',
                                                'nodes': [
                                                    { 'name': 'identifier', 'value': 'Unit' }
                                                ]
                                            },
                                            {
                                                'name': 'block',
                                                'nodes': [
                                                    { 'name': 'open-brace', 'value': '{' },
                                                    { 'name': 'close-brace', 'value': '}' }
                                                ]
                                            }
                                        ]
                                    }]
                                }]
                            }
                        ]
                    }]
                }]
            }]
        })
    })

    it('parse unary-expr', () => {
        const rule = parseToken('-3', 'expr')
        expect(compactToken(rule!)).toEqual({
            'name': 'expr',
            'nodes': [
                {
                    'name': 'prefix-op',
                    'nodes': [
                        { 'name': 'minus', 'value': '-' }
                    ]
                },
                {
                    'name': 'operand',
                    'nodes': [
                        { 'name': 'number', 'value': '3' }
                    ]
                }]
        })
    })

    it('parse function call', () => {
        const rule = parseToken('foo(12)', 'expr')
        expect(compactToken(rule!)).toEqual({
            'name': 'expr', 'nodes': [{ 'name': 'operand', 'nodes': [{ 'name': 'identifier', 'value': 'foo' }] }, {
                'name': 'postfix-op', 'nodes': [{
                    'name': 'call-op',
                    'nodes': [{ 'name': 'open-paren', 'value': '(' }, {
                        'name': 'args',
                        'nodes': [{
                            'name': 'expr',
                            'nodes': [{ 'name': 'operand', 'nodes': [{ 'name': 'number', 'value': '12' }] }]
                        }]
                    }, { 'name': 'close-paren', 'value': ')' }]
                }]
            }]
        })
    })

    it('parse expr1', () => {
        const rule = parseToken('(foo(12) / 4)', 'expr')
        expect(compactToken(rule!)).toEqual({
            'name': 'expr', 'nodes': [{
                'name': 'operand', 'nodes': [{ 'name': 'open-paren', 'value': '(' }, {
                    'name': 'expr',
                    'nodes': [{ 'name': 'operand', 'nodes': [{ 'name': 'identifier', 'value': 'foo' }] }, {
                        'name': 'postfix-op', 'nodes': [{
                            'name': 'call-op', 'nodes': [{ 'name': 'open-paren', 'value': '(' }, {
                                'name': 'args',
                                'nodes': [{
                                    'name': 'expr',
                                    'nodes': [{ 'name': 'operand', 'nodes': [{ 'name': 'number', 'value': '12' }] }]
                                }]
                            }, { 'name': 'close-paren', 'value': ')' }]
                        }]
                    }, { 'name': 'infix-operator', 'nodes': [{ 'name': 'slash', 'value': '/' }] }, {
                        'name': 'operand',
                        'nodes': [{ 'name': 'number', 'value': '4' }]
                    }]
                }, { 'name': 'close-paren', 'value': ')' }]
            }]
        })
    })

    it('parse expr2', () => {
        const rule = parseToken('(foo(12) / 4) * "str".ok()', 'expr')
        expect(compactToken(rule!)).toEqual({
            'name': 'expr', 'nodes': [{
                'name': 'operand', 'nodes': [{ 'name': 'open-paren', 'value': '(' }, {
                    'name': 'expr',
                    'nodes': [{ 'name': 'operand', 'nodes': [{ 'name': 'identifier', 'value': 'foo' }] }, {
                        'name': 'postfix-op', 'nodes': [{
                            'name': 'call-op', 'nodes': [{ 'name': 'open-paren', 'value': '(' }, {
                                'name': 'args',
                                'nodes': [{
                                    'name': 'expr',
                                    'nodes': [{ 'name': 'operand', 'nodes': [{ 'name': 'number', 'value': '12' }] }]
                                }]
                            }, { 'name': 'close-paren', 'value': ')' }]
                        }]
                    }, { 'name': 'infix-operator', 'nodes': [{ 'name': 'slash', 'value': '/' }] }, {
                        'name': 'operand',
                        'nodes': [{ 'name': 'number', 'value': '4' }]
                    }]
                }, { 'name': 'close-paren', 'value': ')' }]
            }, { 'name': 'infix-operator', 'nodes': [{ 'name': 'asterisk', 'value': '*' }] }, {
                'name': 'operand',
                'nodes': [{ 'name': 'string', 'value': '"str"' }]
            }]
        })
    })

    it('parse function-expr', () => {
        const code = `(): Unit {}`
        const rule = parseToken(code, 'expr')
        expect(compactToken(rule!)).toEqual({
            'name': 'expr', 'nodes': [{
                'name': 'operand', 'nodes': [{
                    'name': 'function-expr',
                    'nodes': [
                        { 'name': 'open-paren', 'value': '(' },
                        { 'name': 'close-paren', 'value': ')' },
                        { 'name': 'colon', 'value': ':' },
                        {
                            'name': 'type',
                            'nodes': [
                                { 'name': 'identifier', 'value': 'Unit' }
                            ]
                        },
                        {
                            'name': 'block',
                            'nodes': [
                                { 'name': 'open-brace', 'value': '{' },
                                { 'name': 'close-brace', 'value': '}' }
                            ]
                        }
                    ],
                }]
            }]

        })
    })

})
