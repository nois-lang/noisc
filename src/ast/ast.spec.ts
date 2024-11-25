import { makeConfig } from '../config'
import { tokenize } from '../lexer/lexer'
import { Parser } from '../parser'
import { parseModule } from '../parser/fns'
import { Context, idFromString } from '../scope'
import { Module, buildModuleAst, compactAstNode } from './index'

describe('ast', () => {
    /**
     * Use the following function to get compact tree output:
     * inspect(compactAstNode(ast.block), { depth: null, compact: true, breakLength: 120 })
     */
    const buildAst = (code: string): Module => {
        const source = { code, filepath: 'test.no' }

        const p = new Parser(tokenize(source.code))
        parseModule(p)
        const parseTree = p.buildTree()

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
        return buildModuleAst(parseTree, idFromString('test'), source, false, ctx)
    }

    describe('string', () => {
        it('basic', () => {
            const ast = buildAst('"str"')
            // biome-ignore format: compact
            expect(compactAstNode(ast.block)).toEqual(
{ kind: 'block', statements: [ { kind: 'operand-expr', operand: { kind: 'string-literal', value: '"str"' } } ] }
            )
        })

        it('escaped interpolated', () => {
            const ast = buildAst('"str \\{foo}"')
            // biome-ignore format: compact
            expect(compactAstNode(ast.block)).toEqual(
{ kind: 'block', statements: [ { kind: 'operand-expr', operand: { kind: 'string-literal', value: '"str \\{foo}"' } } ] }
            )
        })

        it('interpolated', () => {
            const ast = buildAst('"str {foo}"')
            // biome-ignore format: compact
            expect(compactAstNode(ast.block)).toEqual(
{ kind: 'block',
  statements:
   [ { kind: 'operand-expr',
       operand:
        { kind: 'string-interpolated',
          tokens:
           [ 'str ',
             { kind: 'operand-expr', operand: { kind: 'identifier', names: [ { kind: 'name', value: 'foo' } ], typeArgs: [] } } ] } } ] }
            )
        })

        it('nested interpolated', () => {
            const ast = buildAst('"str {foo("str {bar}")}"')
            // biome-ignore format: compact
            expect(compactAstNode(ast.block)).toEqual(
{ kind: 'block',
  statements:
   [ { kind: 'operand-expr',
       operand:
        { kind: 'string-interpolated',
          tokens:
           [ 'str ',
             { kind: 'unary-expr',
               operand: { kind: 'operand-expr', operand: { kind: 'identifier', names: [ { kind: 'name', value: 'foo' } ], typeArgs: [] } },
               op:
                { kind: 'call-op',
                  args:
                   [ { kind: 'arg',
                       name: undefined,
                       expr:
                        { kind: 'operand-expr',
                          operand:
                           { kind: 'string-interpolated',
                             tokens:
                              [ 'str ',
                                { kind: 'operand-expr', operand: { kind: 'identifier', names: [ { kind: 'name', value: 'bar' } ], typeArgs: [] } } ] } } } ] } } ] } } ] }
            )
        })
    })

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
            // biome-ignore format: compact
            expect(compactAstNode(ast.block)).toEqual(
{ kind: 'block',
  statements:
   [ { kind: 'type-def',
       name: { kind: 'name', value: 'Option' },
       typeParams: [ { kind: 'type-param', name: { kind: 'name', value: 'T' }, bounds: [] } ],
       variants:
        [ { kind: 'variant',
            name: { kind: 'name', value: 'Some' },
            fields:
             [ { kind: 'field-def',
                 name: { kind: 'name', value: 'value' },
                 fieldType: { kind: 'identifier', names: [ { kind: 'name', value: 'T' } ], typeArgs: [] },
                 pub: false } ] },
          { kind: 'variant', name: { kind: 'name', value: 'None' }, fields: [] } ],
       pub: false } ] }
            )
        })
    })

    describe('var-def', () => {
        it('keyword as name', () => {
            const ast = buildAst('let type = fn() {}')
            // biome-ignore format: compact
            expect(compactAstNode(ast.block)).toEqual(
{ kind: 'block',
  statements:
   [ { kind: 'var-def',
       pattern: { kind: 'pattern', name: undefined, expr: { kind: 'name', value: 'type' } },
       varType: undefined,
       expr:
        { kind: 'operand-expr',
          operand: { kind: 'fn-def', typeParams: [], params: [], block: { kind: 'block', statements: [] }, returnType: undefined } },
       pub: false } ] }
            )
        })
    })

    describe('operand', () => {
        it('basic', () => {
            const ast = buildAst('a')
            // biome-ignore format: compact
            expect(compactAstNode(ast.block)).toEqual(
{ kind: 'block',
  statements: [ { kind: 'operand-expr', operand: { kind: 'identifier', names: [ { kind: 'name', value: 'a' } ], typeArgs: [] } } ] }
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
       op: { kind: 'add-op' },
       lOperand: { kind: 'operand-expr', operand: { kind: 'int-literal', value: '1' } },
       rOperand:
        { kind: 'binary-expr',
          op: { kind: 'mult-op' },
          lOperand: { kind: 'operand-expr', operand: { kind: 'int-literal', value: '2' } },
          rOperand: { kind: 'operand-expr', operand: { kind: 'int-literal', value: '3' } } } } ] }
            )
        })

        it('method call', () => {
            const ast = buildAst('a.b()')
            // biome-ignore format: compact
            expect(compactAstNode(ast.block)).toEqual(
{ kind: 'block',
  statements:
   [ { kind: 'unary-expr',
       operand: { kind: 'operand-expr', operand: { kind: 'identifier', names: [ { kind: 'name', value: 'a' } ], typeArgs: [] } },
       op:
        { kind: 'compose-op',
          operand:
           { kind: 'unary-expr',
             operand: { kind: 'operand-expr', operand: { kind: 'identifier', names: [ { kind: 'name', value: 'b' } ], typeArgs: [] } },
             op: { kind: 'call-op', args: [] } } } } ] }
            )
        })

        it('method call with type args', () => {
            const ast = buildAst('a.b<A>()')
            // biome-ignore format: compact
            expect(compactAstNode(ast.block)).toEqual(
{ kind: 'block',
  statements:
   [ { kind: 'unary-expr',
       operand: { kind: 'operand-expr', operand: { kind: 'identifier', names: [ { kind: 'name', value: 'a' } ], typeArgs: [] } },
       op:
        { kind: 'compose-op',
          operand:
           { kind: 'unary-expr',
             operand:
              { kind: 'operand-expr',
                operand:
                 { kind: 'identifier',
                   names: [ { kind: 'name', value: 'b' } ],
                   typeArgs: [ { kind: 'identifier', names: [ { kind: 'name', value: 'A' } ], typeArgs: [] } ] } },
             op: { kind: 'call-op', args: [] } } } } ] }
            )
        })

        it('method call chain', () => {
            const ast = buildAst('a.b().c().d()')
            // biome-ignore format: compact
            expect(compactAstNode(ast.block)).toEqual(
{ kind: 'block',
  statements:
   [ { kind: 'unary-expr',
       operand:
        { kind: 'unary-expr',
          operand:
           { kind: 'unary-expr',
             operand: { kind: 'operand-expr', operand: { kind: 'identifier', names: [ { kind: 'name', value: 'a' } ], typeArgs: [] } },
             op:
              { kind: 'compose-op',
                operand:
                 { kind: 'unary-expr',
                   operand: { kind: 'operand-expr', operand: { kind: 'identifier', names: [ { kind: 'name', value: 'b' } ], typeArgs: [] } },
                   op: { kind: 'call-op', args: [] } } } },
          op:
           { kind: 'compose-op',
             operand:
              { kind: 'unary-expr',
                operand: { kind: 'operand-expr', operand: { kind: 'identifier', names: [ { kind: 'name', value: 'c' } ], typeArgs: [] } },
                op: { kind: 'call-op', args: [] } } } },
       op:
        { kind: 'compose-op',
          operand:
           { kind: 'unary-expr',
             operand: { kind: 'operand-expr', operand: { kind: 'identifier', names: [ { kind: 'name', value: 'd' } ], typeArgs: [] } },
             op: { kind: 'call-op', args: [] } } } } ] }
            )
        })

        it('postfix op chain', () => {
            const ast = buildAst('a.b()!?()')
            // biome-ignore format: compact
            expect(compactAstNode(ast.block)).toEqual(
{ kind: 'block',
  statements:
   [ { kind: 'unary-expr',
       operand:
        { kind: 'unary-expr',
          operand:
           { kind: 'unary-expr',
             operand:
              { kind: 'unary-expr',
                operand: { kind: 'operand-expr', operand: { kind: 'identifier', names: [ { kind: 'name', value: 'a' } ], typeArgs: [] } },
                op:
                 { kind: 'compose-op',
                   operand:
                    { kind: 'unary-expr',
                      operand: { kind: 'operand-expr', operand: { kind: 'identifier', names: [ { kind: 'name', value: 'b' } ], typeArgs: [] } },
                      op: { kind: 'call-op', args: [] } } } },
             op: { kind: 'unwrap-op' } },
          op: { kind: 'bind-op' } },
       op: { kind: 'call-op', args: [] } } ] }
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
