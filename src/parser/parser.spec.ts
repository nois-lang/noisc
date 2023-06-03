import {tokenize} from '../lexer/lexer'
import {expect} from '@jest/globals'
import {compactToken, generateTransforms, generateTree} from './parser'

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
            'statement': {
                'function-def': {
                    'block': {
                        'close-brace': '}',
                        'open-brace': '{'
                    },
                    'colon': ':',
                    'fn-keyword': 'fn',
                    'identifier': 'Unit',
                    'params': {
                        'close-paren': ')',
                        'open-paren': '('
                    }
                }
            }
        })
    })

})
