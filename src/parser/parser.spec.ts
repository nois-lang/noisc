import { compactNode, parseModule, Parser } from './parser'
import { tokenize } from '../lexer/lexer'
import { expect } from '@jest/globals'

describe('parser', () => {

    const parse = (code) => {
        const p = new Parser(tokenize(code))
        parseModule(p)
        const tree = p.buildTree()
        return { tree: compactNode(tree), errors: p.errors }
    }

    describe('parse fn-def', () => {
        it('empty', () => {
            const { tree, errors } = parse('fn main() {}')
            expect(errors.length).toEqual(0)
            expect(tree).toEqual({
                'module': [{
                    'statement': [{
                        'fn-def': [
                            { 'fn-keyword': 'fn' },
                            { 'identifier': 'main' },
                            { 'o-paren': '(' }, { 'c-paren': ')' },
                            { 'block': [{ 'o-brace': '{' }, { 'c-brace': '}' }] }
                        ]
                    }]
                }]
            })
        })
    })

    describe('parse fn-def', () => {
        it('miss identifier', () => {
            const { errors } = parse('let = 4')
            expect(errors.length).toEqual(1)
            expect(errors[0]).toEqual({
                'expected': ['identifier'],
                'got': {
                    'kind': 'equals',
                    'location': {
                        'end': 4,
                        'start': 4
                    },
                    'value': '='
                }
            })
        })
    })

    describe('parse if-expr', () => {
        it('general', () => {
            const { tree, errors } = parse('if a { b } else { c }')
            expect(errors.length).toEqual(0)
            expect(tree).toEqual({
                'module': [{
                    'statement': [{
                        'expr': [{
                            'sub-expr': [{
                                'operand': [{
                                    'if-expr': [
                                        { 'if-keyword': 'if' },
                                        { 'expr': [{ 'sub-expr': [{ 'operand': [{ 'identifier': 'a' }] }] }] },
                                        {
                                            'block': [
                                                { 'o-brace': '{' },
                                                {
                                                    'statement': [{
                                                        'expr': [{ 'sub-expr': [{ 'operand': [{ 'identifier': 'b' }] }] }]
                                                    }]
                                                },
                                                { 'c-brace': '}' }
                                            ]
                                        },
                                        { 'else-keyword': 'else' },
                                        {
                                            'block': [
                                                { 'o-brace': '{' },
                                                {
                                                    'statement': [{
                                                        'expr': [{ 'sub-expr': [{ 'operand': [{ 'identifier': 'c' }] }] }]
                                                    }]
                                                },
                                                { 'c-brace': '}' }
                                            ]
                                        }
                                    ]
                                }]
                            }]
                        }]
                    }]
                }]
            })
        })

        it('mismatch paren', () => {

            const { errors } = parse('if a { b) }')
            expect(errors.length).toEqual(1)
            expect(errors[0]).toEqual({
                'expected': [],
                'got': { 'kind': 'c-paren', 'location': { 'end': 8, 'start': 8 }, 'value': ')' },
                'message': 'expected operand'
            })
        })

        it('duplicate else clause', () => {
            const { errors } = parse('if a { b } else { c } else { d }')
            expect(errors.length).toEqual(3)
            expect(errors[0]).toEqual({
                'expected': [],
                'got': { 'kind': 'else-keyword', 'location': { 'end': 25, 'start': 22 }, 'value': 'else' },
                'message': 'expected statement'
            })
        })
    })

})
