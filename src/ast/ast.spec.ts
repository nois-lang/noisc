import { tokenize } from '../lexer/lexer'
import { Parser } from '../parser'
import { parseModule } from '../parser/fns'
import { vidFromString } from '../scope/util'
import { Module, buildModuleAst, compactAstNode } from './index'

describe('ast', () => {
    /**
     * Use the following function to get compact tree output:
     * inspect(compactAstNode(ast), { depth: null, compact: true, breakLength: 120 })
     */
    const buildAst = (code: string): Module => {
        const source = { code, filepath: 'test.no' }

        const p = new Parser(tokenize(source.code))
        parseModule(p)
        const parseTree = p.buildTree()

        return buildModuleAst(parseTree, vidFromString('test'), source, false)
    }

    describe('use-stmt', () => {
        it('nested', () => {
            const ast = buildAst('use std::iter::{self, Iter, Iterator}')
            // biome-ignore format: compact
            expect(compactAstNode(ast.useExprs[0])).toEqual(
{ kind: 'use-expr',
  scope: [ { kind: 'name', value: 'std' }, { kind: 'name', value: 'iter' } ],
  expr:
   [ { kind: 'use-expr', scope: [], expr: { kind: 'name', value: 'self' }, pub: false },
     { kind: 'use-expr', scope: [], expr: { kind: 'name', value: 'Iter' }, pub: false },
     { kind: 'use-expr', scope: [], expr: { kind: 'name', value: 'Iterator' }, pub: false } ],
  pub: false }
            )
        })
    })

    describe('type-def', () => {
        it('variant type', () => {
            const ast = buildAst('type Option<T> { Some(value: T), None }')
            expect(compactAstNode(ast.block)).toEqual({
                kind: 'block',
                statements: [
                    {
                        kind: 'type-def',
                        name: { kind: 'name', value: 'Option' },
                        generics: [{ kind: 'generic', name: { kind: 'name', value: 'T' }, bounds: [] }],
                        variants: [
                            {
                                kind: 'variant',
                                name: { kind: 'name', value: 'Some' },
                                fieldDefs: [
                                    {
                                        kind: 'field-def',
                                        name: { kind: 'name', value: 'value' },
                                        fieldType: {
                                            kind: 'identifier',
                                            names: [{ kind: 'name', value: 'T' }],
                                            typeArgs: []
                                        },
                                        pub: false
                                    }
                                ]
                            },
                            { kind: 'variant', name: { kind: 'name', value: 'None' }, fieldDefs: [] }
                        ],
                        pub: false
                    }
                ]
            })
        })
    })

    describe('fn-def', () => {
        it('keyword as name', () => {
            const ast = buildAst('fn type() {}')
            expect(compactAstNode(ast.block)).toEqual({
                kind: 'block',
                statements: [
                    {
                        block: {
                            kind: 'block',
                            statements: []
                        },
                        generics: [],
                        kind: 'fn-def',
                        name: {
                            kind: 'name',
                            value: 'type'
                        },
                        params: [],
                        returnType: undefined,
                        topLevelChecked: false,
                        pub: false
                    }
                ]
            })
        })
    })

    describe('operand', () => {
        it('operand-expr', () => {
            const ast = buildAst('a.b')
            // biome-ignore format: compact
            expect(compactAstNode(ast.block)).toEqual(
{ kind: 'block',
  statements:
   [ { kind: 'binary-expr',
       binaryOp: { kind: 'access-op' },
       lOperand: { kind: 'identifier', names: [{ kind: 'name', value: 'a' }], typeArgs: [] },
       rOperand: { kind: 'identifier', names: [{ kind: 'name', value: 'b' }], typeArgs: [] } } ] }
            )
        })
    })

    describe('expr', () => {
        it('basic', () => {
            const ast = buildAst('1 + 2 * 3')
            // biome-ignore format: compact
            expect(compactAstNode(ast.block)).toEqual(
{ kind: 'block',
  statements:
   [ { kind: 'binary-expr',
       binaryOp: { kind: 'add-op' },
       lOperand: { kind: 'int-literal', value: '1' },
       rOperand:
        { kind: 'binary-expr',
          binaryOp: { kind: 'mult-op' },
          lOperand: { kind: 'int-literal', value: '2' },
          rOperand: { kind: 'int-literal', value: '3' } } } ] }
            )
        })

        it('method call', () => {
            const ast = buildAst('a.b()')
            // biome-ignore format: compact
            expect(compactAstNode(ast.block)).toEqual(
{ kind: 'block',
  statements:
   [ { kind: 'binary-expr',
       binaryOp: { kind: 'access-op' },
       lOperand: { kind: 'identifier', names: [ { kind: 'name', value: 'a' } ], typeArgs: [] },
       rOperand:
        { kind: 'unary-expr',
          op: { kind: 'call-op', args: [] },
          operand: { kind: 'identifier', names: [ { kind: 'name', value: 'b' } ], typeArgs: [] } } } ] }
            )
        })

        it('method call chain', () => {
            const ast = buildAst('a.b().c().d()')
            // biome-ignore format: compact
            expect(compactAstNode(ast.block)).toEqual(
{ kind: 'block',
  statements:
   [ { kind: 'binary-expr',
       binaryOp: { kind: 'access-op' },
       lOperand:
        { kind: 'binary-expr',
          binaryOp: { kind: 'access-op' },
          lOperand:
           { kind: 'binary-expr',
             binaryOp: { kind: 'access-op' },
             lOperand: { kind: 'identifier', names: [ { kind: 'name', value: 'a' } ], typeArgs: [] },
             rOperand:
              { kind: 'unary-expr',
                operand: { kind: 'identifier', names: [ { kind: 'name', value: 'b' } ], typeArgs: [] },
                op: { kind: 'call-op', args: [] } } },
          rOperand:
           { kind: 'unary-expr',
             operand: { kind: 'identifier', names: [ { kind: 'name', value: 'c' } ], typeArgs: [] },
             op: { kind: 'call-op', args: [] } } },
       rOperand:
        { kind: 'unary-expr',
          operand: { kind: 'identifier', names: [ { kind: 'name', value: 'd' } ], typeArgs: [] },
          op: { kind: 'call-op', args: [] } } } ] }
            )
        })
    })

    describe('list init', () => {
        it('empty', () => {
            const ast = buildAst('[]')
            expect(compactAstNode(ast.block)).toEqual({
                kind: 'block',
                statements: [
                    {
                        kind: 'operand-expr',
                        operand: {
                            kind: 'list-expr',
                            exprs: []
                        }
                    }
                ]
            })
        })

        it('basic', () => {
            const ast = buildAst('[1, 2, 3]')
            expect(compactAstNode(ast.block)).toEqual({
                kind: 'block',
                statements: [
                    {
                        kind: 'operand-expr',
                        operand: {
                            kind: 'list-expr',
                            exprs: [
                                {
                                    kind: 'operand-expr',
                                    operand: { kind: 'int-literal', value: '1' }
                                },
                                {
                                    kind: 'operand-expr',
                                    operand: { kind: 'int-literal', value: '2' }
                                },
                                {
                                    kind: 'operand-expr',
                                    operand: { kind: 'int-literal', value: '3' }
                                }
                            ]
                        }
                    }
                ]
            })
        })
    })
})
