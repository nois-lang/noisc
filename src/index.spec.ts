import { readFileSync } from 'fs'
import { buildModuleAst } from './ast'
import { tokenize } from './lexer/lexer'
import { Parser } from './parser'
import { parseModule } from './parser/fns'

describe('nois', () => {
    it('parse features', () => {
        const filepath = 'data/features.no'
        const source = { code: readFileSync(filepath).toString(), filepath }
        const tokens = tokenize(source.code)

        expect(tokens.filter(t => t.kind === 'unknown').length).toEqual(0)

        const parser = new Parser(tokens)
        parseModule(parser)

        expect(parser.errors).toEqual([])

        const root = parser.buildTree()

        expect(root.kind).toEqual('module')

        const astRoot = buildModuleAst(root, { names: ['test'] }, source, false)

        expect(astRoot.kind).toEqual('module')
    })
})
