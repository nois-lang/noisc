import { expect } from '@jest/globals'
import { join } from 'path'
import { defaultConfig } from '../config'
import { Package } from '../package'
import { buildModule, buildPackage } from '../package/build'
import { Context, pathToVid } from '../scope'
import { findImpls } from '../scope/trait'
import { Source } from '../source'
import { checkModule } from './index'

describe('semantic', () => {

    const check = (code: string, checkStd: boolean = false): Context => {
        const source: Source = { code, filepath: 'test.no' }

        const moduleAst = buildModule(source, pathToVid(source.filepath))!
        const pkg: Package = {
            path: source.filepath,
            name: moduleAst?.identifier.names.at(-1)!,
            modules: [moduleAst]
        }

        const std = buildPackage(join(__dirname, '..', 'std'), 'std')!

        const config = defaultConfig()
        const packages = [std, pkg]
        const ctx: Context = {
            config,
            moduleStack: [],
            packages,
            impls: packages.flatMap(p => p.modules).flatMap(findImpls),
            errors: [],
            warnings: []
        }

        if (checkStd) {
            ctx.packages.flatMap(p => p.modules).forEach(m => { checkModule(m, ctx) })
        } else {
            checkModule(moduleAst, ctx)
        }

        return ctx
    }

    describe('std', () => {
        it('check std', () => {
            const ctx = check('', true)
            expect(ctx.errors.map(e => e.message)).toEqual([])
        })
    })

    describe('typecheck', () => {
        it('variant type arg', () => {
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
            expect(ctx.errors.map(e => e.message)).toEqual(['type error: expected test::Foo<std::string::String>\n            got      test::Foo<std::int::Int>'])
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

        it('instance and fn generics', () => {
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
            expect(ctx.errors.map(e => e.message)).toEqual(['type error: expected test::Foo<std::int::Int>\n            got      test::Foo<std::string::String>'])
        })

        it('self operand', () => {
            const code = (arg: string): string => `\
type Foo { Foo }

impl Foo {
    fn foo(self): Unit {
        let s: ${arg} = self
    }
}

fn main() {
    let f = Foo::Foo()
    f.foo()
}`
            let ctx = check(code('Self'))
            expect(ctx.errors.map(e => e.message)).toEqual([])

            ctx = check(code('Foo'))
            expect(ctx.errors.map(e => e.message)).toEqual([])

            ctx = check(code('Int'))
            expect(ctx.errors.map(e => e.message)).toEqual(['type error: expected std::int::Int\n            got      test::Foo'])
        })

        xit('instance fns should not be available within itself', () => {
            const code = 'trait Foo { fn foo() { foo() } }'
            const ctx = check(code)
            expect(ctx.errors.map(e => e.message)).toEqual(['error'])
        })

        xit('instance fns should not be available without trait qualifier', () => {
            const code = (arg: string): string => `\
trait Foo {
    fn foo() {}
}

fn main() {
    Foo::foo()
    ${arg}
}`
            let ctx = check(code(''))
            expect(ctx.errors.map(e => e.message)).toEqual(['error'])

            ctx = check(code('Foo::'))
            expect(ctx.errors.map(e => e.message)).toEqual([])
        })
    })
})
