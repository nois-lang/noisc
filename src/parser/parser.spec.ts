import { Parser } from '.'
import { tokenize } from '../lexer/lexer'
import { parseModule } from './fns'
import { compactParseNode } from './index'

describe('parser', () => {
    /**
     * Use the following function to get compact tree output:
     * inspect(tree, { depth: null, compact: true, breakLength: 120 })
     */
    const parse = (code: string) => {
        const p = new Parser(tokenize(code))
        parseModule(p)
        const tree = p.buildTree()
        return { tree: compactParseNode(tree), errors: p.errors }
    }

    describe('parse use-stmt', () => {
        it('nested', () => {
            const { tree, errors } = parse('use std::iter::{self, Iter, Iterator}')
            expect(errors.length).toEqual(0)
            // biome-ignore format: compact
            expect(tree).toEqual(
{ module:
   [ { 'use-stmt':
        [ { 'use-keyword': 'use' },
          { 'use-expr':
             [ { name: 'std' },
               { colon: ':' },
               { colon: ':' },
               { name: 'iter' },
               { colon: ':' },
               { colon: ':' },
               { 'use-list':
                  [ { 'o-brace': '{' },
                    { 'use-expr': [ { name: 'self' } ] },
                    { comma: ',' },
                    { 'use-expr': [ { name: 'Iter' } ] },
                    { comma: ',' },
                    { 'use-expr': [ { name: 'Iterator' } ] },
                    { 'c-brace': '}' } ] } ] } ] } ] }
            )
        })
    })
    describe('parse type-def', () => {
        it('empty', () => {
            const { tree, errors } = parse('type Unit')
            expect(errors.length).toEqual(0)
            expect(tree).toEqual({
                module: [{ statement: [{ 'type-def': [{ 'type-keyword': 'type' }, { name: 'Unit' }] }] }]
            })
        })

        it('variant type', () => {
            const { tree, errors } = parse('type Option<T> { Some(value: T), None }')
            expect(errors.length).toEqual(0)
            // biome-ignore format: compact
            expect(tree).toEqual(
{ module:
   [ { statement:
        [ { 'type-def':
             [ { 'type-keyword': 'type' },
               { name: 'Option' },
               { generics: [ { 'o-angle': '<' }, { generic: [ { name: 'T' } ] }, { 'c-angle': '>' } ] },
               { 'variant-list':
                  [ { 'o-brace': '{' },
                    { variant:
                       [ { name: 'Some' },
                         { 'variant-params':
                            [ { 'o-paren': '(' },
                              { 'field-def':
                                 [ { name: 'value' },
                                   { 'type-annot': [ { colon: ':' }, { type: [ { 'type-bounds': [ { identifier: [ { name: 'T' } ] } ] } ] } ] } ] },
                              { 'c-paren': ')' } ] } ] },
                    { comma: ',' },
                    { variant: [ { name: 'None' } ] },
                    { 'c-brace': '}' } ] } ] } ] } ] }
            )
        })
    })

    describe('parse fn-def', () => {
        it('empty', () => {
            const { tree, errors } = parse('fn main() {}')
            expect(errors.length).toEqual(0)
            expect(tree).toEqual({
                module: [
                    {
                        statement: [
                            {
                                'fn-def': [
                                    { 'fn-keyword': 'fn' },
                                    { name: 'main' },
                                    { params: [{ 'o-paren': '(' }, { 'c-paren': ')' }] },
                                    { block: [{ 'o-brace': '{' }, { 'c-brace': '}' }] }
                                ]
                            }
                        ]
                    }
                ]
            })
        })

        it('keyword as name', () => {
            const { tree, errors } = parse('fn type() {}')
            expect(errors.length).toEqual(0)
            expect(tree).toEqual({
                module: [
                    {
                        statement: [
                            {
                                'fn-def': [
                                    { 'fn-keyword': 'fn' },
                                    { 'type-keyword': 'type' },
                                    { params: [{ 'o-paren': '(' }, { 'c-paren': ')' }] },
                                    { block: [{ 'o-brace': '{' }, { 'c-brace': '}' }] }
                                ]
                            }
                        ]
                    }
                ]
            })
        })
    })

    describe('parse var-def', () => {
        it('miss identifier', () => {
            const { errors } = parse('let = 4')
            expect(errors.length).toEqual(2)
            expect(errors[0]).toEqual({
                expected: [],
                got: { kind: 'equals', span: { end: 5, start: 4 }, value: '=' },
                message: 'expected pattern'
            })
        })
    })

    describe('parse fn call', () => {
        it('qualified fn', () => {
            const { tree, errors } = parse('a(B::b(4))')
            expect(errors.length).toEqual(0)
            // biome-ignore format: compact
            expect(tree).toEqual(
{ module:
   [ { statement:
        [ { expr:
             [ { 'sub-expr':
                  [ { operand: [ { identifier: [ { name: 'a' } ] } ] },
                    { 'call-op':
                       [ { 'o-paren': '(' },
                         { arg:
                            [ { expr:
                                 [ { 'sub-expr':
                                      [ { operand: [ { identifier: [ { name: 'B' }, { colon: ':' }, { colon: ':' }, { name: 'b' } ] } ] },
                                        { 'call-op':
                                           [ { 'o-paren': '(' },
                                             { arg: [ { expr: [ { 'sub-expr': [ { operand: [ { number: [ { int: '4' } ] } ] } ] } ] } ] },
                                             { 'c-paren': ')' } ] } ] } ] } ] },
                         { 'c-paren': ')' } ] } ] } ] } ] } ] }
            )
        })
    })

    describe('parse if-expr', () => {
        it('general', () => {
            const { tree, errors } = parse('if a { b } else { c }')
            expect(errors.length).toEqual(0)
            // biome-ignore format: compact
            expect(tree).toEqual(
{ module:
   [ { statement:
        [ { expr:
             [ { 'sub-expr':
                  [ { operand:
                       [ { 'if-expr':
                            [ { 'if-keyword': 'if' },
                              { expr: [ { 'sub-expr': [ { operand: [ { identifier: [ { name: 'a' } ] } ] } ] } ] },
                              { block:
                                 [ { 'o-brace': '{' },
                                   { statement: [ { expr: [ { 'sub-expr': [ { operand: [ { identifier: [ { name: 'b' } ] } ] } ] } ] } ] },
                                   { 'c-brace': '}' } ] },
                              { 'else-keyword': 'else' },
                              { block:
                                 [ { 'o-brace': '{' },
                                   { statement: [ { expr: [ { 'sub-expr': [ { operand: [ { identifier: [ { name: 'c' } ] } ] } ] } ] } ] },
                                   { 'c-brace': '}' } ] } ] } ] } ] } ] } ] } ] }
            )
        })

        it('mismatch paren', () => {
            const { errors } = parse('if a { b) }')
            expect(errors.length).toEqual(1)
            expect(errors[0]).toEqual({
                expected: [],
                got: { kind: 'c-paren', span: { end: 9, start: 8 }, value: ')' },
                message: 'expected statement'
            })
        })

        it('duplicate else clause', () => {
            const { errors } = parse('if a { b } else { c } else { d }')
            expect(errors.length).toEqual(2)
            expect(errors[0]).toEqual({
                expected: [],
                got: { kind: 'o-brace', span: { end: 28, start: 27 }, value: '{' },
                message: 'expected statement'
            })
        })
    })
    describe('parse comments', () => {
        const { tree } = parse('foo\n// comment here\nbar')
        // biome-ignore format: compact
        expect(tree).toEqual(
{ module:
   [ { statement:
        [ { expr: [ { 'sub-expr': [ { operand: [ { identifier: [ { name: 'foo' } ] } ] } ] } ] } ] },
     { statement:
        [ { comment: '// comment here' },
          { expr: [ { 'sub-expr': [ { operand: [ { identifier: [ { name: 'bar' } ] } ] } ] } ] } ] } ] }
        )
    })
})
