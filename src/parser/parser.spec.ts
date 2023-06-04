import { tokenize } from '../lexer/lexer'
import { expect } from '@jest/globals'
import { compactToken, generateTransforms, generateTree, ParserTokenName } from './parser'

describe('parser', () => {

    const parse = (code: string, root: ParserTokenName = 'program') => {
        const tokens = tokenize(code)
        const chain = generateTransforms(tokens, root)
        return generateTree(tokens, chain)
    }

    it('parse basic', () => {
        const code = `let main = (): Unit {}`
        const rule = parse(code)
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
                                    'name': 'sub-expr',
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
                                }]
                            }
                        ]
                    }]
                }]
            }]
        })
    })

    it('parse unary-expr', () => {
        const rule = parse('-3', 'expr')
        expect(compactToken(rule!)).toEqual({
            'name': 'expr',
            'nodes': [{
                'name': 'sub-expr', 'nodes': [
                    {
                        'name': 'prefix-op',
                        'nodes': [{
                            'name': 'minus', 'value': '-'
                        }]
                    },
                    {
                        'name': 'operand',
                        'nodes': [{
                            'name': 'number', 'value': '3'
                        }]
                    }]
            }]
        })
    })

    it('parse function-expr', () => {
        const code = `(): Unit {}`
        const rule = parse(code, 'expr')
        expect(compactToken(rule!)).toEqual({
            'name': 'expr', 'nodes': [{
                'name': 'sub-expr', 'nodes': [{
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
            }]

        })
    })

})
