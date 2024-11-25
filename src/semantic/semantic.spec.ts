import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { Module } from '../ast'
import { makeConfig } from '../config'
import { Package } from '../package'
import { buildModule } from '../package/build'
import { buildPackage } from '../package/io'
import { checkImpl } from '../phase/impl'
import { registerImpl } from '../phase/impl-register'
import { resolveImports, setExports } from '../phase/import-resolve'
import { resolveModuleScope } from '../phase/module-resolve'
import { resolveName } from '../phase/name-resolve'
import { setStdTypeIds } from '../phase/std-type'
import { desugar } from '../phase/sugar'
import { setTopScopeType } from '../phase/top-scope-type'
import { collectTypeBounds } from '../phase/type-bound'
import { unifyTypeBounds } from '../phase/type-unify'
import { Context, eachModule, idToString, pathToId } from '../scope'
import { Source } from '../source'

describe('semantic', () => {
    const check = (code: string): Context | undefined => {
        const source: Source = { code, filepath: 'test.no' }
        const ctx: Context = {
            config: makeConfig('test', 'test.no'),
            moduleStack: [],
            packages: [],
            stdTypeIds: {},
            errors: [],
            warnings: [],
            unifyStack: [],
            variableCounter: 0
        }

        const moduleAst = buildModule(source, pathToId(source.filepath), ctx)!
        if (!moduleAst) return undefined
        const pkg: Package = {
            path: source.filepath,
            name: moduleAst?.identifier.names.at(-1)!.value,
            modules: [moduleAst],
            compiled: false
        }

        const std = buildPackage(join(dirname(fileURLToPath(import.meta.url)), '..', 'std'), 'std', ctx)!

        ctx.packages = [std, pkg]
        ctx.prelude = std.modules.find(m => m.identifier.names.at(-1)!.value === 'prelude')!

        const phases: ((module: Module, ctx: Context) => void)[] = [
            (node, ctx) => desugar(node, 'init', ctx),
            resolveModuleScope,
            setExports,
            resolveImports,
            setStdTypeIds,
            registerImpl,
            (node, ctx) => desugar(node, 'pre-name-resolve', ctx),
            resolveName,
            setTopScopeType,
            checkImpl,
            collectTypeBounds,
            unifyTypeBounds
        ]
        phases.forEach(f => eachModule(f, ctx))

        return ctx
    }

    describe('std', () => {
        it('check std', () => {
            const ctx = check('')
            expect(ctx)
            expect(ctx!.errors.map(e => e.message)).toEqual([])
        })
    })

    describe('typecheck', () => {
        it('variant type arg', () => {
            const code = (type: string): string => `\
type Foo<T> {
    A(v: T),
    B
}

let main = fn() {
    let f = Foo::A(v: 4)
    let check: Foo<${type}> = f
}`
            let ctx = check(code('Int'))
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([])

            ctx = check(code('String'))
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([
                'type error: expected test::Foo<std::string::String>\n            got      test::Foo<std::int::Int>'
            ])
        })
    })

    describe('use expr', () => {
        it('ok', () => {
            const code = `use std::iter::{self, Iter, Iterable}`
            const ctx = check(code)
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([])
            const module = ctx!.packages.at(-1)!.modules[0]
            expect(module.reExports!.length).toEqual(0)
            expect(module.references!.map(idToString)).toEqual(['std::iter', 'std::iter::Iter', 'std::iter::Iterable'])
        })

        it('re-export', () => {
            const code = `pub use std::iter::{self, Iter, Iterable}`
            const ctx = check(code)
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([])
            const module = ctx!.packages.at(-1)!.modules[0]
            expect(module.reExports!.map(idToString)).toEqual(['std::iter', 'std::iter::Iter', 'std::iter::Iterable'])
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
    let foo = fn(self, other: T): Foo<T> {
        self
    }
}

let main = fn() {
    let f = Foo::A(v: 4)
    let a = f.foo(${arg})
    let check: Foo<Int> = a
}`
            let ctx = check(code('6'))
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([])

            ctx = check(code('"foo"'))
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([
                'type error: expected std::int::Int\n            got      std::string::String'
            ])
        })

        it('fn generics', () => {
            const code = (arg: string): string => `\
let foo<T> = fn(a: T): T {
    a
}

let main = fn() {
    let f = foo(${arg})
    let check: Int = f
}`
            let ctx = check(code('6'))
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([])

            ctx = check(code('"foo"'))
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([
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
    let foo = fn<O>(self, other: O): Foo<O> {
        Foo::A(v: other)
    }
}

let main = fn() {
    let f = Foo::A(v: 4)
    let a = f.foo(${arg})
    let check: Foo<Int> = a
}`
            let ctx = check(code('6'))
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([])

            ctx = check(code('"foo"'))
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([
                'type error: expected test::Foo<std::int::Int>\n            got      test::Foo<std::string::String>'
            ])
        })

        it('self operand', () => {
            const code = (arg: string): string => `\
type Foo { Foo }

impl Foo {
    let foo = fn(self): Unit {
        let s: ${arg} = self
    }
}

let main = fn() {
    let f = Foo::Foo()
    f.foo()
}`
            let ctx = check(code('Self'))
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([])

            ctx = check(code('Foo'))
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([])

            ctx = check(code('Int'))
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([
                'type error: expected std::int::Int\n            got      test::Foo'
            ])
        })

        it('instance fns should not be available within itself', () => {
            const code = 'trait Foo { fn foo() { foo() } }'
            const ctx = check(code)
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual(['identifier `foo` not found', 'unknown type'])
        })

        it('replace unresolved generics with hole type', () => {
            const code = `\
let none = fn<T>(): Option<T> {
    None()
}

let main = fn() {
    let a = none()
    a()
}`
            const ctx = check(code)
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([
                'type error: non-callable operand of type `std::option::Option<_>`'
            ])
        })
    })

    describe('statement order', () => {
        it('type is used in method def before it is defined', () => {
            const code = `\
type Foo

impl Foo {
    let foo = fn(): Bar {
        Bar::Bar()
    }
}

type Bar()`
            const ctx = check(code)
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([])
        })

        it('fn is used in fn before it is defined', () => {
            const code = `\
let main = fn() {
    foo()
}

let foo = fn() {}`
            const ctx = check(code)
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([])
        })
    })

    describe('destructuring', () => {
        it('destruct in fn param', () => {
            const code = `\
type Foo(a: Int, b: Int)

let bar = fn(Foo(a, b): Foo) {
    a()
    b()
}`
            const ctx = check(code)
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([
                'type error: non-callable operand of type `std::int::Int`',
                'type error: non-callable operand of type `std::int::Int`'
            ])
        })

        it('destruct in fn param named', () => {
            const code = `\
type Foo(a: Int, b: Int)

let bar = fn(Foo(a: namedA @ _, b: namedB @ _): Foo) {
    a()
    b()
    namedA()
    namedB()
}`
            const ctx = check(code)
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([
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

let bar = fn(Foo(b: Bar(a)): Foo) {
    b()
    a()
}`
            const ctx = check(code)
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([
                'identifier `b` not found',
                'unknown type',
                'type error: non-callable operand of type `std::int::Int`'
            ])
        })

        it('destruct pattern binding', () => {
            const code = `\
type Foo(a: Int)

let bar = fn(foo @ Foo(a): Foo) {
    foo()
}`
            const ctx = check(code)
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual(['type error: non-callable operand of type `test::Foo`'])
        })
    })

    describe('list expr', () => {
        it('empty', () => {
            const code = `\
let main = fn() {
    let a = []
    a()
}`
            const ctx = check(code)
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([
                'type error: non-callable operand of type `std::list::List<_>`'
            ])
        })

        it('multi', () => {
            const code = (a: string, b: string) => `\
let main = fn() {
    let a = [${a}, ${b}]
    a()
}`
            let ctx = check(code('1', '2'))
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([
                'type error: non-callable operand of type `std::list::List<std::int::Int>`'
            ])

            ctx = check(code('1', '"foo"'))
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([
                'type error: expected std::int::Int\n            got      std::string::String',
                'type error: non-callable operand of type `std::list::List<std::int::Int>`'
            ])

            ctx = check(code('Option::Some(4)', '"foo"'))
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([
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

let main = fn() {
    let expr = Const(v: 4)
    match expr {
        Add(l: Add()) {}
        Const() {}
    }
}`
            const ctx = check(code)
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([
                'non-exhaustive match expression, unmatched paths:\n    Expr::Add(l: Expr::Const(), r: _) {}'
            ])
        })

        it('union', () => {
            const code = `\
type Expr {
    Add(l: Expr, r: Expr),
    Const(v: Int)
}

let main = fn() {
    let expr = Const(v: 4)
    match expr {
        Add() | Const() {}
    }
}`
            const ctx = check(code)
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([])
        })

        it('unreachable match clause', () => {
            const code = `\
type Expr {
    Add(l: Expr, r: Expr),
    Const(v: Int)
}

let main = fn() {
    let expr = Const(v: 4)
    match expr {
        Add() {}
        Const() {}
        _ {}
    }
}`
            const ctx = check(code)
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([])

            expect(ctx!.warnings.map(e => e.message)).toEqual(['unreachable match clause'])
        })

        it('clauses type mismatch', () => {
            const code = (arg: string) => `\
type Expr {
    Add(l: Expr, r: Expr),
    Const(v: Int)
}

let main = fn() {
    let expr = Const(v: 4)
    ${arg}match expr {
        Add() { "foo" }
        Const() { 5 }
        _ {}
    }
    return unit
}`
            let ctx = check(code(''))
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([])

            ctx = check(code('let a = '))
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([
                'match clauses have incompatible types:\n    std::string::String\n    std::int::Int\n    std::unit::Unit'
            ])
        })
    })

    describe('break stmt', () => {
        it('ok', () => {
            const code = `\
let main = fn() {
    while true {
        break
    }
}`
            const ctx = check(code)
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([])
        })

        it('no loop scope', () => {
            const code = `\
let main = fn() {
    break
}`
            const ctx = check(code)
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual(['outside of the loop'])
        })

        it('from closure', () => {
            const code = `\
let main = fn() {
    while true {
        {fn() { break }}()
    }
}`
            const ctx = check(code)
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual(['outside of the loop'])
        })
    })

    describe('constructor call', () => {
        it('pos call', () => {
            const code = `\
type Foo(x: Int)

let main = fn() {
    let foo = Foo(5)
    foo()
    return unit
}`
            const ctx = check(code)
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual(['type error: non-callable operand of type `test::Foo`'])
        })

        it('named call', () => {
            const code = (arg: string) => `\
type Foo(x: Int)

let main = fn() {
    let foo = Foo(${arg}: 5)
    foo()
    return unit
}`
            let ctx = check(code('x'))
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual(['type error: non-callable operand of type `test::Foo`'])

            ctx = check(code('y'))
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual(['field `y` not found', 'unknown type', 'unknown type'])
        })

        it('fn named call', () => {
            const code = `\
let main = fn() {
    let foo = println(value = "str")
    return unit
}`
            const ctx = check(code)
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual(['unexpected named argument `value`'])
        })

        it('wrong arg count', () => {
            const code = (arg: string) => `\
type Foo(x: Int)

let main = fn() {
    let foo = Foo(${arg})
    foo()
    return unit
}`
            let ctx = check(code(''))
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual(['missing fields: `x`', 'unknown type', 'unknown type'])

            ctx = check(code('x: 5, y: 6'))
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual(['field `y` not found', 'unknown type', 'unknown type'])
        })
    })

    describe('var def', () => {
        it('missing init', () => {
            const code = `\
type Node<T> {
    Node(node: Node<T>),
    Leaf(t: T)
}

let main = fn() {
    let n
}`
            const ctx = check(code)
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual(['missing variable initialization'])
        })
    })

    describe('type def', () => {
        it('duplicate variant', () => {
            const code = `\
type Foo {
    A(),
    A()
}`
            const ctx = check(code)
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual(['duplicate variant `A`'])
        })

        it('duplicate field', () => {
            const code = `type Foo(a: Int, a: String)`
            const ctx = check(code)
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual(['duplicate field `a`'])
        })
    })

    describe('fn def', () => {
        it('fn no body', () => {
            const code = 'let main = fn()'
            const ctx = check(code)
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual(['fn `child` has no body'])
        })
    })

    describe('string interpolation', () => {
        it('basic', () => {
            const code = `\
let main = fn() {
    let foo = 5
    let s = "{foo}"
    s()
    return unit
}`
            const ctx = check(code)
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([
                'type error: non-callable operand of type `std::string::String`'
            ])
        })

        it('composite', () => {
            const code = `\
let main = fn() {
    let foo = 5
    let s = "a {foo} b"
    s()
    return unit
}`
            const ctx = check(code)
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([
                'type error: non-callable operand of type `std::string::String`'
            ])
        })

        it('nested', () => {
            const code = `\
let main = fn() {
    let foo = 5
    let s = "a {"c"} b"
    s()
    return unit
}`
            const ctx = check(code)
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([
                'type error: non-callable operand of type `std::string::String`'
            ])
        })

        it('operand impls Show', () => {
            const code = (arg: string) => `\
type Foo()
${arg}
let main = fn() {
    let foo = Foo()
    let s = "{foo}"
    s()
    return unit
}`
            let ctx = check(code(''))
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([
                'type error: expected std::io::show::Show\n            got      test::Foo',
                'type error: non-callable operand of type `std::string::String`'
            ])

            ctx = check(code('impl Show for Foo { let show = fn(self): String { "" } }'))
            expect(ctx).toBeDefined()
            expect(ctx!.errors.map(e => e.message)).toEqual([
                'type error: non-callable operand of type `std::string::String`'
            ])
        })
    })
})
