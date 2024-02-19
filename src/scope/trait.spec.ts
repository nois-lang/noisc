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
        const std = buildPackage(join(dirname(fileURLToPath(import.meta.url)), '..', 'std'), 'std')!

        const config = makeConfig('test', 'test.no')
        const ctx: Context = {
            config,
            moduleStack: [],
            packages: [std],
            prelude: std.modules.find(m => m.identifier.names.at(-1)! === 'prelude')!,
            impls: [],
            errors: [],
            warnings: [],
            check: false,
            silent: false
        }

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

        expect(formatImplTypes(findSuperRelChains(vidFromString('std::unit::Unit'), ctx))).toEqual([])

        expect(formatImplTypes(findSuperRelChains(vidFromString('std::string::String'), ctx))).toEqual([
            ['std::io::Display'],
            ['std::eq::Eq']
        ])

        expect(formatImplTypes(findSuperRelChains(vidFromString('std::list::List'), ctx))).toEqual([
            ['std::iter::Iterable<T>'],
            ['std::iter::Collector<T>'],
            ['std::io::Display'],
            ['std::io::Display']
        ])

        expect(formatImplTypes(findSuperRelChains(vidFromString('std::list::ListIter'), ctx))).toEqual([
            ['std::iter::Iter<T>'],
            ['std::iter::Iter<T>', 'std::iter::intersperseIter::IntersperseAdapter<T>'],
            ['std::iter::Iter<T>', 'std::iter::mapIter::MapAdapter<T>'],
            ['std::iter::Iter<T>', 'std::iter::Iterable<T>'],
            ['std::iter::Iter<T>', 'std::iter::peekable::PeekableAdapter<T>']
        ])
    })
})
