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

    if (ctx.errors.length > 0) return ctx

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

    symlinkSync('dist', 'tmp/node_modules')
}

const run = (ctx: Context): SpawnSyncReturns<Buffer> => {
    if (ctx.errors.length > 0) throw Error(`semantic errors:\n${ctx.errors.map(e => `\t${e.message}`).join('\n')}`)
    return spawnSync('node', ['dist/test/mod.js'], { cwd: 'tmp' })
}

describe('e2e', () => {
    beforeAll(async () => {
        rmdirSync('tmp', { recursive: true })
        await compileStd()
    })

    beforeEach(() => {
        rmdirSync('tmp/test', { recursive: true })
        rmdirSync('tmp/dist/test', { recursive: true })
    })

    describe('general', () => {
        it('minimal', async () => {
            const files = { 'mod.no': 'pub fn main() {}' }
            const res = run(await compile(files))
            expect(res.stderr.toString()).toEqual('')
            expect(res.stdout.toString()).toEqual('')
        })

        it('hello', async () => {
            const files = {
                'mod.no': `\
pub fn main(): Unit {
    println("Hello, World!")
}`
            }
            const res = run(await compile(files))
            expect(res.stderr.toString()).toEqual('')
            expect(res.stdout.toString()).toEqual('Hello, World!\n')
        })

        it('example', async () => {
            const files = {
                'mod.no': `\
use std::{ math::pi, iter::MapAdapter }

trait Area {
    fn area(self): Float
}

type Shape {
    Rect(width: Float, height: Float),
    Circle(radius: Float),
}

impl Area for Shape {
    fn area(self): Float {
        match self {
            Shape::Rect(width, height) { width * height }
            Shape::Circle(radius) { pi * radius ^ 2. }
        }
    }
}

pub fn main() {
    let shapes: List<Shape> = [
        Shape::Rect(width: 4., height: 2.),
        Shape::Circle(radius: 12.34),
    ]
    println(
        shapes
            .iter()
            .map(|s| s.area())
            .collect<List<_>>()
            .show()
    )
}`
            }
            const res = run(await compile(files))
            expect(res.stderr.toString()).toEqual('')
            expect(res.stdout.toString()).toEqual('[8, 478.3879062809779]\n')
        })

        it('rule110', async () => {
            const files = {
                'mod.no': `\
use std::iter::MapAdapter

pub fn main() {
    let n = 10
    rule110(n)
}

fn rule110(n: Int) {
    let init = [true]
    println(fmtGen(init, n))
    range(1, n).fold(|gen, _| {
        let ng = nextGen(gen)
        println(fmtGen(ng, n))
        ng
    }, init)
    unit
}

fn nextGen(prev: List<Bool>): List<Bool> {
    range(-1, prev.iter().count())
        .map(|i| {
            let left = prev.at(i - 1).or(Some(false))!
            let mid = prev.at(i).or(Some(false))!
            let right = prev.at(i + 1).or(Some(false))!
            return (
                (left && mid && right) ||
                (left && mid.not() && right.not()) ||
                (left.not() && mid.not() && right.not())
            ).not()
        })
        .collect<List<Bool>>()
}

fn fmtGen(gen: List<Bool>, total: Int): String {
    let pad = repeat(" ", total - gen.iter().count()).collect<String>()
    let g = gen
        .iter()
        .map(|b| if b { "x" } else { " " })
        .collect<String>()
    pad.concat(g)
}`
            }
            const res = run(await compile(files))
            expect(res.stderr.toString()).toEqual('')
            expect(res.stdout.toString()).toEqual(
                '         x\n        xx\n       xxx\n      xx x\n     xxxxx\n    xx   x\n   xxx  xx\n  xx x xxx\n xxxxxxx x\nxx     xxx\n'
            )
        })

        describe('param destructuring', () => {
            it('con pattern', async () => {
                const files = {
                    'mod.no': `\
type Foo(x: Int, y: String)

pub fn main() {
    println(foo(Foo(1, "y")))
}

fn foo(Foo(y): Foo): String {
    y
}`
                }
                const res = run(await compile(files))
                expect(res.stderr.toString()).toEqual('')
                expect(res.stdout.toString()).toEqual('y\n')
            })
        })
    })

    describe('method call', () => {
        it('qualified', async () => {
            const files = {
                'mod.no': `\
use std::unwrap::Unwrap

pub fn main() {
    println(Unwrap::unwrap(Some(4)).trace())
}`
            }
            const res = run(await compile(files))
            expect(res.stderr.toString()).toEqual('')
            expect(res.stdout.toString()).toEqual('4\n')
        })
    })

    describe('match', () => {
        it('int', async () => {
            const files = {
                'mod.no': `\
pub fn main() {
    let a = match 4 {
        2 { false }
        4 { true }
        _ { false }
    }
    println(a.trace())
}`
            }
            const res = run(await compile(files))
            expect(res.stderr.toString()).toEqual('')
            expect(res.stdout.toString()).toEqual('true\n')
        })

        it('float', async () => {
            const files = {
                'mod.no': `\
pub fn main() {
    let a = match 4.5 {
        2. { false }
        4.5 { true }
        _ { false }
    }
    println(a.trace())
}`
            }
            const res = run(await compile(files))
            expect(res.stderr.toString()).toEqual('')
            expect(res.stdout.toString()).toEqual('true\n')
        })

        it('string', async () => {
            const files = {
                'mod.no': `\
pub fn main() {
    let a = match "foo" {
        "" { false }
        "bar" { false }
        "foo" { true }
        _ { false }
    }
    println(a.trace())
}`
            }
            const res = run(await compile(files))
            expect(res.stderr.toString()).toEqual('')
            expect(res.stdout.toString()).toEqual('true\n')
        })

        it('char', async () => {
            const files = {
                'mod.no': `\
pub fn main() {
    let a = match 'a' {
        'b' { false }
        'a' { true }
        _ { false }
    }
    println(a.trace())
}`
            }
            const res = run(await compile(files))
            expect(res.stderr.toString()).toEqual('')
            expect(res.stdout.toString()).toEqual('true\n')
        })

        it('list', async () => {
            const files = {
                'mod.no': `\
pub fn main() {
    let a = match [1, 2] {
        [] { false }
        [1, 2, 3] { false }
        [1, 2] { true }
        _ { false }
    }
    println(a.trace())
}`
            }
            const res = run(await compile(files))
            expect(res.stderr.toString()).toEqual('')
            expect(res.stdout.toString()).toEqual('true\n')
        })

        it('con-pattern', async () => {
            const files = {
                'mod.no': `\
type Foo { A(), B(b: Int) }
pub fn main() {
    let a = match B(6) {
        A() { false }
        B(b: 5) { false }
        B(b) { true }
        _ { false }
    }
    println(a.trace())
}`
            }
            const res = run(await compile(files))
            expect(res.stderr.toString()).toEqual('')
            expect(res.stdout.toString()).toEqual('true\n')
        })
    })
})
