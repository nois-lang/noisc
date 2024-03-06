import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { makeConfig } from '../config'
import { Package } from '../package'
import { buildModule } from '../package/build'
import { buildPackage } from '../package/io'
import { Context, pathToVid } from '../scope'
import { buildInstanceRelations } from '../scope/trait'
import { vidToString } from '../scope/util'
import { Source } from '../source'
import { checkModule, checkTopLevelDefinition, prepareModule } from './index'

describe('semantic', () => {
    const check = (code: string, checkStd: boolean = false): Context => {
        const source: Source = { code, filepath: 'test.no' }

        const moduleAst = buildModule(source, pathToVid(source.filepath))!
        const pkg: Package = {
            path: source.filepath,
            name: moduleAst?.identifier.names.at(-1)!,
            modules: [moduleAst],
            compiled: false
        }

        const std = buildPackage(join(dirname(fileURLToPath(import.meta.url)), '..', 'std'), 'std')!

        const ctx: Context = {
            config: makeConfig('test', 'test.no'),
            moduleStack: [],
            packages: [std, pkg],
            prelude: std.modules.find(m => m.identifier.names.at(-1)! === 'prelude')!,
            impls: [],
            errors: [],
            warnings: [],
            check: false,
            silent: false,
            variableCounter: 0
        }

        ctx.packages.forEach(p => {
            p.modules.forEach(m => {
                prepareModule(m)
            })
        })
        ctx.impls = buildInstanceRelations(ctx)
        ctx.impls.forEach(impl => checkTopLevelDefinition(impl.module, impl.instanceDef, ctx))
        ctx.check = true
        if (checkStd) {
            ctx.packages.flatMap(p => p.modules).forEach(m => checkModule(m, ctx))
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
            expect(ctx.errors.map(e => e.message)).toEqual([
                'type error: expected test::Foo<std::string::String>\n            got      test::Foo<std::int::Int>'
            ])
        })
    })

    describe('use expr', () => {
        it('ok', () => {
            const code = `use std::iter::{self, Iter, Iterable}`
            const ctx = check(code, false)
            expect(ctx.errors.map(e => e.message)).toEqual([])
            const module = ctx.packages.at(-1)!.modules[0]
            expect(module.reExports!.length).toEqual(0)
            expect(module.references!.map(r => r.vid).map(vidToString)).toEqual([
                'std::iter',
                'std::iter::Iter',
                'std::iter::Iterable'
            ])
        })

        it('re-export', () => {
            const code = `pub use std::iter::{self, Iter, Iterable}`
            const ctx = check(code, false)
            expect(ctx.errors.map(e => e.message)).toEqual([])
            const module = ctx.packages.at(-1)!.modules[0]
            expect(module.reExports!.map(r => r.vid).map(vidToString)).toEqual([
                'std::iter',
                'std::iter::Iter',
                'std::iter::Iterable'
            ])
            expect(module.references!.length).toEqual(0)
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
            expect(ctx.errors.map(e => e.message)).toEqual([
                'type error: expected std::int::Int\n            got      std::string::String'
            ])
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
            expect(ctx.errors.map(e => e.message)).toEqual([
                'type error: expected std::int::Int\n            got      std::string::String'
            ])
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
            expect(ctx.errors.map(e => e.message)).toEqual([
                'type error: expected test::Foo<std::int::Int>\n            got      test::Foo<std::string::String>'
            ])
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
            expect(ctx.errors.map(e => e.message)).toEqual([
                'type error: expected std::int::Int\n            got      test::Foo'
            ])
        })

        it('instance fns should not be available within itself', () => {
            const code = 'trait Foo { fn foo() { foo() } }'
            const ctx = check(code)
            expect(ctx.errors.map(e => e.message)).toEqual(['identifier `foo` not found', 'unknown type'])
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
            expect(ctx.errors.map(e => e.message)).toEqual(['identifier `foo` not found', 'unknown type'])

            ctx = check(code('Foo::'))
            expect(ctx.errors.map(e => e.message)).toEqual([])
        })

        it('clashing generic name', () => {
            const code = (arg: string): string => `\
fn foo<T>() {
    let a: Option<T> = Option::None()
    let b = a.unwrap()
    b()
    return unit
}`
            const ctx = check(code('Unit'))
            expect(ctx.errors.map(e => e.message)).toEqual(['type error: non-callable operand of type `T`'])
        })

        it('replace unresolved generics with hole type', () => {
            const code = `\
fn none<T>(): Option<T> {
    Option::None()
}

fn main() {
    let a = none()
    a()
}`
            const ctx = check(code)
            expect(ctx.errors.map(e => e.message)).toEqual([
                'type error: non-callable operand of type `std::option::Option<_>`'
            ])
        })
    })

    describe('statement order', () => {
        it('type is used in method def before it is defined', () => {
            const code = `\
type Foo

impl Foo {
    fn foo(): Bar {
        Bar::Bar()
    }
}

type Bar()`
            const ctx = check(code)
            expect(ctx.errors.map(e => e.message)).toEqual([])
        })

        it('fn is used in fn before it is defined', () => {
            const code = `\
fn main() {
    foo()
}

fn foo() {}`
            const ctx = check(code)
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
            const ctx = check(code)
            expect(ctx.errors.map(e => e.message)).toEqual([
                'type error: non-callable operand of type `std::int::Int`',
                'type error: non-callable operand of type `std::int::Int`'
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
            const ctx = check(code)
            expect(ctx.errors.map(e => e.message)).toEqual([
                'identifier `a` not found',
                'unknown type',
                'identifier `b` not found',
                'unknown type',
                'type error: non-callable operand of type `std::int::Int`',
                'type error: non-callable operand of type `std::int::Int`'
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
            const ctx = check(code)
            expect(ctx.errors.map(e => e.message)).toEqual([
                'identifier `b` not found',
                'unknown type',
                'type error: non-callable operand of type `std::int::Int`'
            ])
        })

        it('destruct pattern binding', () => {
            const code = `\
type Foo(a: Int)

fn bar(foo @ Foo::Foo(a): Foo) {
    foo()
}`
            const ctx = check(code)
            expect(ctx.errors.map(e => e.message)).toEqual(['type error: non-callable operand of type `test::Foo`'])
        })
    })

    describe('if expr', () => {
        it('simple', () => {
            const code = `\
fn main() {
    if true { "foo" }
    if true { 4 } else { "foo" }
    unit
}`
            const ctx = check(code)
            expect(ctx.errors.map(e => e.message)).toEqual([])
        })

        it('incompatible branches', () => {
            const code = (arg: string) => `\
fn main() {
    let a = if true { 4 } else { ${arg} }
    a()
}`
            let ctx = check(code('5'))
            expect(ctx.errors.map(e => e.message)).toEqual(['type error: non-callable operand of type `std::int::Int`'])

            ctx = check(code('"foo"'))
            expect(ctx.errors.map(e => e.message)).toEqual([
                'if branches have incompatible types:\n    then: `std::int::Int`\n    else: `std::string::String`',
                'unknown type'
            ])
        })
    })

    describe('if let expr', () => {
        it('simple', () => {
            const code = (arg: string) => `\
fn main() {
    if let Option::Some(value) = ${arg} {
        value()
    } else {
        value()
    }
}`
            let ctx = check(code('Option::Some(value: 4)'))
            expect(ctx.errors.map(e => e.message)).toEqual([
                'type error: non-callable operand of type `std::int::Int`',
                'type error: non-callable operand of type `std::int::Int`'
            ])

            ctx = check(code('4'))
            expect(ctx.errors.map(e => e.message)).toEqual([
                'cannot destructure type `std::int::Int` into `std::option::Option`',
                'identifier `value` not found',
                'unknown type',
                'identifier `value` not found',
                'unknown type'
            ])
        })
    })

    describe('list expr', () => {
        it('empty', () => {
            const code = `\
fn main() {
    let a = []
    a()
}`
            const ctx = check(code)
            expect(ctx.errors.map(e => e.message)).toEqual([
                'type error: non-callable operand of type `std::list::List<_>`'
            ])
        })

        it('multi', () => {
            const code = (a: string, b: string) => `\
fn main() {
    let a = [${a}, ${b}]
    a()
}`
            let ctx = check(code('1', '2'))
            expect(ctx.errors.map(e => e.message)).toEqual([
                'type error: non-callable operand of type `std::list::List<std::int::Int>`'
            ])

            ctx = check(code('1', '"foo"'))
            expect(ctx.errors.map(e => e.message)).toEqual([
                'type error: expected std::int::Int\n            got      std::string::String',
                'type error: non-callable operand of type `std::list::List<std::int::Int>`'
            ])

            ctx = check(code('Option::Some(4)', '"foo"'))
            expect(ctx.errors.map(e => e.message)).toEqual([
                'type error: expected std::option::Option<std::int::Int>\n            got      std::string::String',
                'type error: non-callable operand of type `std::list::List<std::option::Option<std::int::Int>>`'
            ])
        })
    })

    describe('match expr', () => {
        it('non-exhaustive', () => {
            const code = `\
type Expr {
    Add(l: Expr, r: Expr),
    Const(v: Int)
}

fn main() {
    let expr = Expr::Const(v: 4)
    match expr {
        Expr::Add(l: Expr::Add()) {}
        Expr::Const() {}
    }
}`
            const ctx = check(code)
            expect(ctx.errors.map(e => e.message)).toEqual([
                'non-exhaustive match expression, unmatched paths:\n    Expr::Add(l: Expr::Const(), r: _) {}'
            ])
        })

        it('union', () => {
            const code = `\
type Expr {
    Add(l: Expr, r: Expr),
    Const(v: Int)
}

fn main() {
    let expr = Expr::Const(v: 4)
    match expr {
        Expr::Add() | Expr::Const() {}
    }
}`
            const ctx = check(code)
            expect(ctx.errors.map(e => e.message)).toEqual([])
        })

        it('unreachable match clause', () => {
            const code = `\
type Expr {
    Add(l: Expr, r: Expr),
    Const(v: Int)
}

fn main() {
    let expr = Expr::Const(v: 4)
    match expr {
        Expr::Add() {}
        Expr::Const() {}
        _ {}
    }
}`
            const ctx = check(code)
            expect(ctx.errors.map(e => e.message)).toEqual([])

            expect(ctx.warnings.map(e => e.message)).toEqual(['unreachable match clause'])
        })

        it('clauses type mismatch', () => {
            const code = (arg: string) => `\
type Expr {
    Add(l: Expr, r: Expr),
    Const(v: Int)
}

fn main() {
    let expr = Expr::Const(v: 4)
    ${arg}match expr {
        Expr::Add() { "foo" }
        Expr::Const() { 5 }
        _ {}
    }
    return unit
}`
            let ctx = check(code(''))
            expect(ctx.errors.map(e => e.message)).toEqual([])

            ctx = check(code('let a = '))
            expect(ctx.errors.map(e => e.message)).toEqual([
                'match clauses have incompatible types:\n    std::string::String\n    std::int::Int\n    std::unit::Unit'
            ])
        })
    })

    describe('break stmt', () => {
        it('ok', () => {
            const code = `\
fn main() {
    while true {
        break
    }
}`
            const ctx = check(code)
            expect(ctx.errors.map(e => e.message)).toEqual([])
        })

        it('no loop scope', () => {
            const code = `\
fn main() {
    break
}`
            const ctx = check(code)
            expect(ctx.errors.map(e => e.message)).toEqual(['`break-stmt` outside of the loop'])
        })

        it('from closure', () => {
            const code = `\
fn main() {
    while true {
        (|| { break })()
    }
}`
            const ctx = check(code)
            expect(ctx.errors.map(e => e.message)).toEqual(['cannot break from within the closure'])
        })
    })

    describe('field access', () => {
        it('ok', () => {
            const code = `\
type Foo(x: Int)

impl Foo {
    fn main() {
        let foo = Foo::Foo(5)
        let a = foo.x
        a()
        return unit
    }
}`
            const ctx = check(code)
            expect(ctx.errors.map(e => e.message)).toEqual(['type error: non-callable operand of type `std::int::Int`'])
        })

        it('field called like a method', () => {
            const code = (arg: string, arg2: string) => `\
type Foo(${arg})

impl Foo {
    fn main() {
        let foo = Foo::Foo(${arg2})
        foo.x()
        return unit
    }
}`
            let ctx = check(code('', ''))
            expect(ctx.errors.map(e => e.message)).toEqual(['method `x` not found'])

            ctx = check(code('x: Int', '5'))
            expect(ctx.errors.map(e => e.message)).toEqual([
                'method `x` not found\n    to access field `x`, surround operand in parentheses'
            ])
        })

        it('field is a closure', () => {
            const code = `\
type Foo(x: ||: Int)

impl Foo {
    fn main() {
        let foo = Foo::Foo(|| { 5 })
        let a = (foo.x)()
        a()
        return unit
    }
}`
            const ctx = check(code)
            expect(ctx.errors.map(e => e.message)).toEqual(['type error: non-callable operand of type `std::int::Int`'])
        })
    })

    describe('constructor call', () => {
        it('pos call', () => {
            const code = `\
type Foo(x: Int)

fn main() {
    let foo = Foo::Foo(5)
    foo()
    return unit
}`
            const ctx = check(code)
            expect(ctx.errors.map(e => e.message)).toEqual(['type error: non-callable operand of type `test::Foo`'])
        })

        it('named call', () => {
            const code = (arg: string) => `\
type Foo(x: Int)

fn main() {
    let foo = Foo::Foo(${arg}: 5)
    foo()
    return unit
}`
            let ctx = check(code('x'))
            expect(ctx.errors.map(e => e.message)).toEqual(['type error: non-callable operand of type `test::Foo`'])

            ctx = check(code('y'))
            expect(ctx.errors.map(e => e.message)).toEqual([
                'missing fields: `x`',
                'unknown field: `y`',
                'unknown type',
                'unknown type'
            ])
        })

        it('wrong arg count', () => {
            const code = (arg: string) => `\
type Foo(x: Int)

impl Foo {
    fn main() {
        let foo = Foo::Foo(${arg})
        foo()
        return unit
    }
}`
            let ctx = check(code(''))
            expect(ctx.errors.map(e => e.message)).toEqual(['missing fields: `x`', 'unknown type', 'unknown type'])

            ctx = check(code('x: 5, y: 6'))
            expect(ctx.errors.map(e => e.message)).toEqual(['unknown field: `y`', 'unknown type', 'unknown type'])
        })
    })
})
