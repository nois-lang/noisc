import { SpawnSyncReturns, spawnSync } from 'child_process'
import { mkdirSync, rmdirSync, symlinkSync, writeFileSync } from 'fs'
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
    const pkgName = 'test'
    const pkgPath = 'tmp/test'

    const config = makeConfig(pkgName, pkgPath)
    config.libPath = 'tmp/dist'
    config.outPath = join(config.libPath, pkgName)

    const modules = Object.entries(files).map(([filepath, code]) => {
        const source: Source = { code, filepath: join(config.srcPath, filepath) }
        return buildModule(source, pathToVid(join('test', filepath)))!
    })
    const pkg: Package = {
        path: pkgPath,
        name: pkgName,
        modules: modules,
        compiled: false
    }

    const std = buildPackage('tmp/dist/std', 'std', true)!

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

const compileStd = async (): Promise<void> => {
    const pkg = buildPackage('./src/std', 'std')!

    const config = makeConfig(pkg.name, pkg.path)
    config.srcPath = pkg.path
    config.libPath = './tmp/dist'
    config.outPath = join(config.libPath, pkg.name)
    const ctx: Context = {
        config,
        moduleStack: [],
        packages: [pkg],
        prelude: pkg.modules.find(m => m.identifier.names.at(-1)! === 'prelude')!,
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
    await emitPackage(true, pkg, ctx)
}

const run = (ctx: Context): SpawnSyncReturns<Buffer> => {
    symlinkSync('dist', 'tmp/node_modules')
    return spawnSync('node', ['dist/test/mod.js'], { cwd: 'tmp' })
}

describe('e2e', () => {
    afterEach(() => {
        rmdirSync('tmp', { recursive: true })
    })

    it('minimal', async () => {
        const files = { 'mod.no': 'pub fn main() {}' }
        await compileStd()
        const res = run(await compile(files))
        expect(res.stdout.toString()).toEqual('')
        expect(res.stderr.toString()).toEqual('')
    })

    it('hello', async () => {
        const files = {
            'mod.no': `
pub fn main(): Unit {
    println("Hello, World!")
}`
        }
        await compileStd()
        const res = run(await compile(files))
        expect(res.stdout.toString()).toEqual('Hello, World!\n')
        expect(res.stderr.toString()).toEqual('')
    })
})
