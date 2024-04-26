import { readFileSync } from 'fs'
import { buildModuleAst } from './ast'
import { makeConfig } from './config'
import { tokenize } from './lexer/lexer'
import { Parser } from './parser'
import { parseModule } from './parser/fns'
import { Context } from './scope'

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

        const ctx: Context = {
            config: makeConfig('test', 'test.no'),
            moduleStack: [],
            packages: [],
            impls: [],
            errors: [],
            warnings: [],
            check: false,
            silent: false,
            variableCounter: 0,
            relChainsMemo: new Map()
        }
        const astRoot = buildModuleAst(root, { names: ['test'] }, source, false, ctx)

        expect(astRoot.kind).toEqual('module')
    })
})
