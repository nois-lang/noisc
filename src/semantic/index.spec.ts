import { defaultConfig } from '../config'
import { buildModule, Context, pathToVid } from '../scope'
import { Module } from '../ast'
import { join, relative } from 'path'
import { getPackageModuleSources } from '../scope/io'
import { checkModule } from './index'
import { Source } from '../source'
import { expect } from '@jest/globals'
import { vidFromString } from '../scope/vid'
import { glanceModule } from './glance'

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
            modules: <Module[]>stdModules,
            errors: [],
            warnings: []
        }
        if (code) {
            const source: Source = { code, filepath: 'test.no' }
            const moduleAst = buildModule(source, vidFromString('test'))
            ctx.modules.push(moduleAst)
        }

        ctx.modules.forEach(m => { glanceModule(m, ctx) })
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
