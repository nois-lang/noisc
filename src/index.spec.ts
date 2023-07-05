import { tokenize } from './lexer/lexer'
import { readFileSync } from 'fs'
import { Parser } from './parser/parser'
import { parseModule } from './parser/fns'
import { buildModuleAst } from './ast'
import { vidFromString } from './scope/vid'

describe('nois', () => {
    it('parse features', () => {
        const filepath = 'data/features.no'
        const source = { code: readFileSync(filepath).toString(), filepath }
        const tokens = tokenize(source.code)

        expect(tokens.filter(t => t.kind === 'unknown').length).toEqual(0)

        const parser = new Parser(tokens)
        parseModule(parser)

        expect(parser.errors.length).toEqual(0)

        const root = parser.buildTree()

        expect(root.kind).toEqual('module')

        const astRoot = buildModuleAst(root, vidFromString('test'), source)

        expect(astRoot.kind).toEqual('module')
    })
})
