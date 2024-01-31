import { tokenize } from '../lexer/lexer'
import { parseModule } from '../parser/fns'
import { Parser } from '../parser/parser'
import { vidFromString } from '../scope/util'
import { Module, buildModuleAst, compactAstNode } from './index'

describe('ast', () => {
    const buildAst = (code: string): Module => {
        const source = { code, filepath: 'test.no' }

        const p = new Parser(tokenize(source.code))
        parseModule(p)
        const parseTree = p.buildTree()

        return buildModuleAst(parseTree, vidFromString('test'), source)
    }

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
                                            scope: [],
                                            name: { kind: 'name', value: 'T' },
                                            typeArgs: []
                                        }
                                    }
                                ]
                            },
                            { kind: 'variant', name: { kind: 'name', value: 'None' }, fieldDefs: [] }
                        ]
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
                        topLevelChecked: false
                    }
                ]
            })
        })
    })

    describe('operand', () => {
        it('operand-expr', () => {
            const ast = buildAst('a.b')
            expect(compactAstNode(ast.block)).toEqual({
                kind: 'block',
                statements: [
                    {
                        binaryOp: {
                            kind: 'access-op'
                        },
                        kind: 'binary-expr',
                        lOperand: {
                            kind: 'operand-expr',
                            operand: {
                                kind: 'identifier',
                                name: {
                                    kind: 'name',
                                    value: 'a'
                                },
                                scope: [],
                                typeArgs: []
                            }
                        },
                        rOperand: {
                            kind: 'operand-expr',
                            operand: {
                                kind: 'identifier',
                                name: {
                                    kind: 'name',
                                    value: 'b'
                                },
                                scope: [],
                                typeArgs: []
                            }
                        }
                    }
                ]
            })
        })
    })

    describe('expr', () => {
        it('basic', () => {
            const ast = buildAst('1 + 2 * 3')
            expect(compactAstNode(ast.block)).toEqual({
                kind: 'block',
                statements: [
                    {
                        binaryOp: { kind: 'add-op' },
                        lOperand: {
                            operand: { kind: 'int-literal', value: '1' },
                            kind: 'operand-expr'
                        },
                        rOperand: {
                            binaryOp: { kind: 'mult-op' },
                            lOperand: {
                                operand: { kind: 'int-literal', value: '2' },
                                kind: 'operand-expr'
                            },
                            rOperand: {
                                operand: { kind: 'int-literal', value: '3' },
                                kind: 'operand-expr'
                            },
                            kind: 'binary-expr'
                        },
                        kind: 'binary-expr'
                    }
                ]
            })
        })

        it('method call', () => {
            const ast = buildAst('a.b()')
            expect(compactAstNode(ast.block)).toEqual({
                kind: 'block',
                statements: [
                    {
                        kind: 'binary-expr',
                        binaryOp: { kind: 'access-op' },
                        lOperand: {
                            kind: 'operand-expr',
                            operand: { kind: 'identifier', scope: [], name: { kind: 'name', value: 'a' }, typeArgs: [] }
                        },
                        rOperand: {
                            kind: 'unary-expr',
                            unaryOp: { kind: 'pos-call', args: [] },
                            operand: { kind: 'identifier', scope: [], name: { kind: 'name', value: 'b' }, typeArgs: [] }
                        }
                    }
                ]
            })
        })

        it('method call chain', () => {
            const ast = buildAst('a.b().c().d()')
            expect(compactAstNode(ast.block)).toEqual({
                kind: 'block',
                statements: [
                    {
                        kind: 'binary-expr',
                        binaryOp: { kind: 'access-op' },
                        lOperand: {
                            kind: 'binary-expr',
                            binaryOp: { kind: 'access-op' },
                            lOperand: {
                                kind: 'binary-expr',
                                binaryOp: { kind: 'access-op' },
                                lOperand: {
                                    kind: 'operand-expr',
                                    operand: {
                                        kind: 'identifier',
                                        scope: [],
                                        name: { kind: 'name', value: 'a' },
                                        typeArgs: []
                                    }
                                },
                                rOperand: {
                                    kind: 'unary-expr',
                                    unaryOp: { kind: 'pos-call', args: [] },
                                    operand: {
                                        kind: 'identifier',
                                        scope: [],
                                        name: { kind: 'name', value: 'b' },
                                        typeArgs: []
                                    }
                                }
                            },
                            rOperand: {
                                kind: 'unary-expr',
                                unaryOp: { kind: 'pos-call', args: [] },
                                operand: {
                                    kind: 'identifier',
                                    scope: [],
                                    name: { kind: 'name', value: 'c' },
                                    typeArgs: []
                                }
                            }
                        },
                        rOperand: {
                            kind: 'unary-expr',
                            unaryOp: { kind: 'pos-call', args: [] },
                            operand: { kind: 'identifier', scope: [], name: { kind: 'name', value: 'd' }, typeArgs: [] }
                        }
                    }
                ]
            })
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
