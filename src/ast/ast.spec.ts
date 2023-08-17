import { tokenize } from '../lexer/lexer'
import { parseModule } from '../parser/fns'
import { Parser } from '../parser/parser'
import { Module, buildModuleAst, compactAstNode } from './index'

describe('ast', () => {

    const buildAst = (code: string): Module => {
        const source = { code, filepath: 'test.no' }

        const p = new Parser(tokenize(source.code))
        parseModule(p)
        const parseTree = p.buildTree()

        return buildModuleAst(parseTree, { scope: [], name: 'test' }, source)
    }

    describe('type-def', () => {
        it('variant type', () => {
            const ast = buildAst('type Option<T> { Some(value: T), None }')
            expect(compactAstNode(ast.block)).toEqual({
                kind: 'block',
                statements:
                    [{
                        kind: 'type-def',
                        name: { kind: 'name', value: 'Option' },
                        generics: [{ kind: 'generic', name: { kind: 'name', value: 'T' }, bounds: [] }],
                        variants:
                            [{
                                kind: 'type-con',
                                name: { kind: 'name', value: 'Some' },
                                fieldDefs:
                                    [{
                                        kind: 'field-def',
                                        name: { kind: 'name', value: 'value' },
                                        fieldType: {
                                            kind: 'identifier',
                                            scope: [],
                                            name: { kind: 'name', value: 'T' },
                                            typeArgs: []
                                        }
                                    }]
                            },
                            { kind: 'type-con', name: { kind: 'name', value: 'None' }, fieldDefs: [] }]
                    }]
            })
        })
    })

    describe('fn-def', () => {
        it('keyword as name', () => {
            const ast = buildAst('fn type() {}')
            expect(compactAstNode(ast.block)).toEqual({
                'kind': 'block',
                'statements': [
                    {
                        'block': {
                            'kind': 'block',
                            'statements': [],
                        },
                        'generics': [],
                        'kind': 'fn-def',
                        'name': {
                            'kind': 'name',
                            'value': 'type',
                        },
                        'params': [],
                        'returnType': undefined,
                    },
                ],
            })
        })
    })

    it('expr', () => {
        const ast = buildAst('1 + 2 * 3')
        expect(compactAstNode(ast.block)).toEqual({
            'kind': 'block',
            'statements': [{
                'binaryOp': { 'kind': 'add-op' },
                'lOperand': {
                    'operand': {
                        'operand': { 'kind': 'int-literal', 'value': '1' },
                        'kind': 'operand-expr'
                    }, 'kind': 'operand-expr'
                },
                'rOperand': {
                    'binaryOp': { 'kind': 'mult-op' },
                    'lOperand': {
                        'operand': {
                            'operand': { 'kind': 'int-literal', 'value': '2' },
                            'kind': 'operand-expr'
                        }, 'kind': 'operand-expr'
                    },
                    'rOperand': {
                        'operand': {
                            'operand': { 'kind': 'int-literal', 'value': '3' },
                            'kind': 'operand-expr'
                        }, 'kind': 'operand-expr'
                    },
                    'kind': 'binary-expr'
                },
                'kind': 'binary-expr'
            }]
        })
    })

    describe('list init', () => {

        it('empty', () => {
            const ast = buildAst('[]')
            expect(compactAstNode(ast.block)).toEqual({
                'kind': 'block',
                'statements': [{
                    'kind': 'operand-expr',
                    'operand': {
                        'kind': 'operand-expr',
                        'operand': {
                            'kind': 'list-expr',
                            'exprs': []
                        }
                    }
                }]
            })
        })

        it('basic', () => {
            const ast = buildAst('[1, 2, 3]')
            expect(compactAstNode(ast.block)).toEqual({
                'kind': 'block',
                'statements': [{
                    'kind': 'operand-expr',
                    'operand': {
                        'kind': 'operand-expr',
                        'operand': {
                            'exprs': [{
                                'kind': 'operand-expr',
                                'operand': {
                                    'kind': 'operand-expr',
                                    'operand': { 'kind': 'int-literal', 'value': '1' }
                                }
                            }, {
                                'kind': 'operand-expr',
                                'operand': {
                                    'kind': 'operand-expr',
                                    'operand': { 'kind': 'int-literal', 'value': '2' }
                                }
                            }, {
                                'kind': 'operand-expr',
                                'operand': {
                                    'kind': 'operand-expr',
                                    'operand': { 'kind': 'int-literal', 'value': '3' }
                                }
                            }], 'kind': 'list-expr'
                        }
                    }
                }]
            })
        })
    })

})
