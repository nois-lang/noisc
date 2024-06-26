import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { Context } from '.'
import { makeConfig } from '../config'
import { buildPackage } from '../package/io'
import { prepareModule } from '../semantic'
import { virtualTypeToString } from '../typecheck'
import { InstanceRelation, buildInstanceRelations, findSuperRelChains } from './trait'
import { vidFromString } from './util'

describe('trait', () => {
    const makeCtx = (): Context => {
        const config = makeConfig('test', 'test.no')
        const ctx: Context = {
            config,
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

        const std = buildPackage(join(dirname(fileURLToPath(import.meta.url)), '..', 'std'), 'std', ctx)!
        ctx.packages = [std]
        ctx.prelude = std.modules.find(m => m.identifier.names.at(-1)! === 'prelude')!

        ctx.packages.forEach(p => {
            p.modules.forEach(m => {
                prepareModule(m)
            })
        })
        ctx.impls = buildInstanceRelations(ctx)
        ctx.check = true

        return ctx
    }

    it('findSuperRelChains', () => {
        const ctx = makeCtx()
        const formatImplTypes = (chains: InstanceRelation[][]): string[][] =>
            chains.map(c => c.map(rel => rel.implType).map(virtualTypeToString))

        expect(formatImplTypes(findSuperRelChains(vidFromString('std::unit::Unit'), ctx))).toEqual([
            ['std::io::trace::Trace']
        ])

        expect(formatImplTypes(findSuperRelChains(vidFromString('std::string::String'), ctx))).toEqual([
            ['std::io::show::Show'],
            ['std::io::trace::Trace'],
            ['std::eq::Eq'],
            ['std::iter::Collector<std::string::String>'],
            ['std::iter::Collector<std::char::Char>'],
            ['std::copy::Copy']
        ])

        expect(formatImplTypes(findSuperRelChains(vidFromString('std::list::List'), ctx))).toEqual([
            ['std::iter::Iterable<T>'],
            ['std::iter::Collector<T>'],
            ['std::io::show::Show'],
            ['std::io::show::Show'],
            ['std::io::trace::Trace'],
            ['std::copy::Copy']
        ])
    })
})
