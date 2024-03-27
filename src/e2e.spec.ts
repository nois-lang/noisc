import { SpawnSyncReturns, spawnSync } from 'child_process'
import { mkdirSync, rmdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { makeConfig } from './config'
import { Package } from './package'
import { buildModule } from './package/build'
import { emitPackage } from './package/emit'
import { buildPackage } from './package/io'
import { Context, pathToVid } from './scope'
import { buildInstanceRelations } from './scope/trait'
import { checkModule, checkTopLevelDefinition, prepareModule } from './semantic'
import { Source } from './source'

const compile = async (files: { [path: string]: string }): Promise<Context> => {
    const modules = Object.entries(files).map(([filepath, code]) => {
        const source: Source = { code, filepath }
        return buildModule(source, pathToVid(source.filepath))!
    })
    const pkg: Package = {
        path: './tmp/test',
        name: 'test',
        modules: modules,
        compiled: false
    }

    const std = buildPackage('./src/std', 'std', true)!

    const config = makeConfig(pkg.name, pkg.path)
    config.libPath = './tmp/dist'
    config.outPath = './tmp/dist/test'
    const ctx: Context = {
        config,
        moduleStack: [],
        packages: [std, pkg],
        prelude: std.modules.find(m => m.identifier.names.at(-1)! === 'prelude')!,
        impls: [],
        errors: [],
        warnings: [],
        check: false,
        silent: false,
        variableCounter: 0,
        relChainsMemo: new Map()
    }

    ctx.packages.forEach(p => {
        p.modules.forEach(m => {
            prepareModule(m)
        })
    })
    ctx.impls = buildInstanceRelations(ctx)
    ctx.impls.forEach(impl => checkTopLevelDefinition(impl.module, impl.instanceDef, ctx))
    ctx.check = true
    pkg.modules.forEach(m => checkModule(m, ctx))

    mkdirSync(pkg.path, { recursive: true })
    writeFileSync(join(pkg.path, 'package.json'), JSON.stringify({ name: 'test', type: 'module' }))
    await emitPackage(true, pkg, ctx)

    return ctx
}

const run = (ctx: Context): SpawnSyncReturns<Buffer> => {
    return spawnSync('node', ['dist/test/mod.js'], { cwd: join(ctx.config.libPath, '..') })
}

describe('e2e', () => {
    afterEach(() => {
        rmdirSync('tmp', { recursive: true })
    })

    it('minimal', async () => {
        const files = { 'mod.no': 'pub fn main() {}' }
        const res = run(await compile(files))
        expect(res.stdout.toString()).toEqual('')
        expect(res.stderr.toString()).toEqual('')
    })
})
