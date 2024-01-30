import { prettyLineAt } from './location'

describe('location', () => {
    it('single line', () => {
        const code = `\
type Expr {
    Add(l: Expr, r: Expr),
    Const(v: nt)
}`
        const source = { code, filepath: '' }
        const report = prettyLineAt({ start: 52, end: 54 }, source)
        expect(report).toEqual(`\
    │ 
  3 │     Const(v: nt)
    │              ^^`)
    })

    it('multiline', () => {
        const code = `\
let a = match expr {
    Expr::Const() { "foo" }
    Expr::Const() { "bar" }
}`
        const source = { code, filepath: '' }
        const report = prettyLineAt({ start: 8, end: 78 }, source)
        expect(report).toEqual(`\
    │┌────────┐
  1 ││let a = match expr {
  2 ││    Expr::Const() { "foo" }
  3 ││    Expr::Const() { "bar" }
  4 ││}
    │└┘`)
    })

    it('multiline skip', () => {
        const code = `\
let a = match expr {
    Expr::Const() { "foo" }
    Expr::Const() { "foo" }
    Expr::Const() { "foo" }
    Expr::Const() { "bar" }
}`
        const source = { code, filepath: '' }
        const report = prettyLineAt({ start: 8, end: 134 }, source)
        expect(report).toEqual(`\
    │┌────────┐
  1 ││let a = match expr {
  2 ││    Expr::Const() { "foo" }
...   
  5 ││    Expr::Const() { "bar" }
  6 ││}
    │└┘`)
    })
})
