import { join } from 'path'
import { defaultConfig } from '../config'
import { Package } from '../package'
import { buildModule, buildPackage } from '../package/build'
import { Context, pathToVid } from '../scope'
import { buildImplRelations } from '../scope/trait'
import { Source } from '../source'
import { checkModule, prepareModule } from './index'

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
            impls: [],
            errors: [],
            warnings: [],
            check: false
        }

        ctx.packages.forEach(p => {
            p.modules.forEach(m => {
                prepareModule(m)
            })
        })
        ctx.impls = buildImplRelations(ctx)
        ctx.check = true
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
            expect(ctx.errors.map(e => e.message)).toEqual(['type error: expected test::Foo<std::int::Int>\n            got      test::Foo<std::string::String>'])
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

        it('instance fns should not be available within itself', () => {
            const code = 'trait Foo { fn foo() { foo() } }'
            const ctx = check(code)
            expect(ctx.errors.map(e => e.message)).toEqual([
                'identifier `foo` not found',
                'type error: non-callable operand of type `?`'
            ])
        })

        it('instance fns should not be available without trait qualifier', () => {
            const code = (arg: string): string => `\
trait Foo {
    fn foo() {}
}

fn main() {
    ${arg}foo()
}`
            let ctx = check(code(''))
            expect(ctx.errors.map(e => e.message)).toEqual([
                'identifier `foo` not found',
                'type error: non-callable operand of type `?`'
            ])

            ctx = check(code('Foo::'))
            expect(ctx.errors.map(e => e.message)).toEqual([])
        })
    })

    describe('statement order', () => {
        it('type is used in method def before it is defined', () => {
            const code = `\
type Foo

impl Foo {
    fn foo(): Bar {}
}

type Bar`
            let ctx = check(code)
            expect(ctx.errors.map(e => e.message)).toEqual([])
        })

        it('fn is used in fn before it is defined', () => {
            const code = `\
fn main() {
    foo()
}

fn foo() {}`
            let ctx = check(code)
            expect(ctx.errors.map(e => e.message)).toEqual([])
        })
    })

    describe('destructuring', () => {
        it('destruct in fn param', () => {
            const code = `\
type Foo(a: Int, b: Int)

fn bar(Foo::Foo(a, b): Foo) {
    a()
    b()
}`
            let ctx = check(code)
            expect(ctx.errors.map(e => e.message)).toEqual([
                'type error: non-callable operand of type `std::int::Int`',
                'type error: non-callable operand of type `std::int::Int`',
            ])
        })

        it('destruct in fn param named', () => {
            const code = `\
type Foo(a: Int, b: Int)

fn bar(Foo::Foo(a: namedA, b: namedB): Foo) {
    a()
    b()
    namedA()
    namedB()
}`
            let ctx = check(code)
            expect(ctx.errors.map(e => e.message)).toEqual([
                'identifier `a` not found',
                'type error: non-callable operand of type `?`',
                'identifier `b` not found',
                'type error: non-callable operand of type `?`',
                'type error: non-callable operand of type `std::int::Int`',
                'type error: non-callable operand of type `std::int::Int`',
            ])
        })

        it('destruct in fn param recursive', () => {
            const code = `\
type Foo(b: Bar)

type Bar(a: Int)

fn bar(Foo::Foo(b: Bar::Bar(a)): Foo) {
    b()
    a()
}`
            let ctx = check(code)
            expect(ctx.errors.map(e => e.message)).toEqual([
                'identifier `b` not found',
                'type error: non-callable operand of type `?`',
                'type error: non-callable operand of type `std::int::Int`',
            ])
        })
    })

    describe('if expr', () => {
        it('simple', () => {
            const code = (arg: string) => `\
fn main() {
    let a = if true { 4 } else { ${arg} }
    a()
}`
            let ctx = check(code('5'))
            expect(ctx.errors.map(e => e.message)).toEqual([
                'type error: non-callable operand of type `std::int::Int`',
            ])

            ctx = check(code('"foo"'))
            expect(ctx.errors.map(e => e.message)).toEqual([
                'if branches have incompatible types:\n    then: `std::int::Int`\n    else: `std::string::String`',
                'type error: non-callable operand of type `?`',
            ])
        })
    })
})
