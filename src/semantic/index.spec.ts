import { defaultConfig } from '../config'
import { Context, pathToVid } from '../scope'
import { join, relative } from 'path'
import { getPackageModuleSources } from '../package/io'
import { checkModule } from './index'
import { Source } from '../source'
import { expect } from '@jest/globals'
import { vidFromString } from '../scope/vid'
import { buildModule } from '../package/build'
import { findImpls } from '../scope/trait'

describe('semantic', () => {

    const check = (code?: string): Context => {
        const stdPath = join(__dirname, '../std')
        const stdModules = getPackageModuleSources(stdPath).map(s => {
            const stdModule = buildModule(s, pathToVid(relative(stdPath, s.filepath), 'std'))
            if (!stdModule) {
                process.exit(1)
            }
            return stdModule
        })

        const config = defaultConfig()
        const ctx: Context = {
            config,
            moduleStack: [],
            modules: stdModules,
            impls: stdModules.flatMap(findImpls),
            errors: [],
            warnings: []
        }
        if (code) {
            const source: Source = { code, filepath: 'test.no' }
            const moduleAst = buildModule(source, vidFromString('test'))
            ctx.modules.push(moduleAst)
        }

        ctx.modules.forEach(m => { checkModule(m, ctx) })

        return ctx
    }

    describe('std', () => {
        it('check std', () => {
            const ctx = check()
            expect(ctx.errors.map(e => e.message)).toEqual([])
        })
    })

})
