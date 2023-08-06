import { defaultConfig } from '../config'
import { Context, pathToVid } from '../scope'
import { join, relative } from 'path'
import { getPackageModuleSources } from '../package/io'
import { checkModule } from './index'
import { Source } from '../source'
import { expect } from '@jest/globals'
import { buildModule } from '../package/build'
import { findImpls } from '../scope/trait'

describe('semantic', () => {

    const check = (code: string, checkStd: boolean = false): Context => {
        const source: Source = { code, filepath: 'test.no' }

        const moduleAst = buildModule(source, pathToVid(source.filepath))
        if (!moduleAst) {
            process.exit(1)
        }

        const stdPath = join(__dirname, '../std')
        const stdModules = getPackageModuleSources(stdPath).map(s => {
            const stdModule = buildModule(s, pathToVid(relative(stdPath, s.filepath), 'std'))
            if (!stdModule) {
                process.exit(1)
            }
            return stdModule
        })

        const config = defaultConfig()
        const modules = [...stdModules, moduleAst]
        const ctx: Context = {
            config,
            moduleStack: [],
            modules,
            impls: modules.flatMap(findImpls),
            errors: [],
            warnings: []
        }

        if (checkStd) {
            stdModules.forEach(m => { checkModule(m, ctx) })
        }
        checkModule(moduleAst, ctx)

        return ctx
    }

    describe('std', () => {
        it('check std', () => {
            const ctx = check('', true)
            expect(ctx.errors.map(e => e.message)).toEqual([])
        })
    })

    describe('typecheck', () => {
        xit('variant type arg', () => {
            const code = (type: string): string => `\
type Foo<T> {
    A(v: T),
    B
}

fn main() {
    let f = Foo::A(v: 4)
    let check: Foo<${type}> = f
}`
            let ctx = check(code('Int'))
            expect(ctx.errors.map(e => e.message)).toEqual([])

            ctx = check(code('String'))
            expect(ctx.errors.map(e => e.message)).toEqual(['type error: expected std::int::Int\n            got      std::string::String'])
        })
    })

    describe('generics', () => {
        it('instance generics', () => {
            const code = (arg: string): string => `\
type Foo<T> {
    A(v: T),
    B
}

impl <T> Foo<T> {
    fn foo(self, other: T): Foo<T> {
        self
    }
}

fn main() {
    let f = Foo::A(v: 4)
    let a = f.foo(${arg})
    let check: Foo<Int> = a
}`
            let ctx = check(code('6'))
            expect(ctx.errors.map(e => e.message)).toEqual([])

            ctx = check(code('"foo"'))
            expect(ctx.errors.map(e => e.message)).toEqual(['type error: expected std::int::Int\n            got      std::string::String'])
        })

        it('fn generics', () => {
            const code = (arg: string): string => `\
fn foo<T>(a: T): T {
    a
}

fn main() {
    let f = foo(${arg})
    let check: Int = f
}`
            let ctx = check(code('6'))
            expect(ctx.errors.map(e => e.message)).toEqual([])

            ctx = check(code('"foo"'))
            expect(ctx.errors.map(e => e.message)).toEqual(['type error: expected std::int::Int\n            got      std::string::String'])
        })

        xit('instance and fn generics', () => {
            const code = (arg: string): string => `\
type Foo<T> {
    A(v: T),
    B
}

impl <T> Foo<T> {
    fn foo<O>(self, other: O): Foo<O> {
        Foo::A(v: other)
    }
}

fn main() {
    let f = Foo::A(v: 4)
    let a = f.foo(${arg})
    let check: Foo<Int> = a
}`
            let ctx = check(code('6'))
            expect(ctx.errors.map(e => e.message)).toEqual([])

            ctx = check(code('"foo"'))
            expect(ctx.errors.map(e => e.message)).toEqual(['type error: expected std::int::Int\n            got      std::string::String'])
        })
    })
})
