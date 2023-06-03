import { tokenize } from '../lexer/lexer'
import { expect } from '@jest/globals'
import { compactToken, generateTransforms, generateTree } from './parser'

describe('parser', () => {

    const parse = (code: string) => {
        const tokens = tokenize(code)
        const chain = generateTransforms(tokens)
        return generateTree(tokens, chain)
    }

    it('parse basic', () => {
        const code = `fn main(): Unit {}`
        const rule = parse(code)
        expect(compactToken(rule)).toEqual({
            'name': 'program',
            'nodes': [
                {
                    'name': 'statements',
                    'nodes': [
                        {
                            'name': 'statement',
                            'nodes': [
                                {
                                    'name': 'function-def',
                                    'nodes': [
                                        {
                                            'name': 'fn-keyword',
                                            'value': 'fn'
                                        },
                                        {
                                            'name': 'identifier',
                                            'value': 'main'
                                        },
                                        {
                                            'name': 'params',
                                            'nodes': [
                                                {
                                                    'name': 'open-paren',
                                                    'value': '('
                                                },
                                                {
                                                    'name': 'close-paren',
                                                    'value': ')'
                                                }
                                            ]
                                        },
                                        {
                                            'name': 'colon',
                                            'value': ':'
                                        },
                                        {
                                            'name': 'identifier',
                                            'value': 'Unit'
                                        },
                                        {
                                            'name': 'block',
                                            'nodes': [
                                                {
                                                    'name': 'open-brace',
                                                    'value': '{'
                                                },
                                                {
                                                    'name': 'close-brace',
                                                    'value': '}'
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        })
    })

})
