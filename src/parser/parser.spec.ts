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

    it('parse fn-def empty', () => {
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
