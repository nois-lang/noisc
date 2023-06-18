import { tokenize } from './lexer/lexer'
import { readFileSync } from 'fs'
import { Parser } from './parser/parser'
import { parseModule } from './parser/fns'
import { buildModuleAst } from './ast'

describe('nois', () => {
    it('parse features', () => {
        const filename = 'features.no'
        const source = { str: readFileSync(`data/${filename}`).toString(), filename }
        const tokens = tokenize(source.str)

        expect(tokens.filter(t => t.kind === 'unknown').length).toEqual(0)

        const parser = new Parser(tokens)
        parseModule(parser)

        expect(parser.errors.length).toEqual(0)

        const root = parser.buildTree()

        expect(root.kind).toEqual('module')

        const astRoot = buildModuleAst(root, { scope: [], name: 'test' })

        expect(astRoot.kind).toEqual('module')
    })
})
