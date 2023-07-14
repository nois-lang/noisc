import { Parser } from '../parser/parser'
import { tokenize } from '../lexer/lexer'
import { parseModule } from '../parser/fns'
import { compactAstNode } from './index'
import { buildExpr } from './expr'
import { ParseTree } from '../parser'

describe('ast', () => {

    const parseTree = (source: string): ParseTree => {
        const p = new Parser(tokenize(source))
        parseModule(p)
        return p.buildTree()
    }

    it('expr', () => {
        const ast = buildExpr(parseTree('1 + 2 * 3'))
        expect(compactAstNode(ast)).toEqual({
            'operand': {
                'operand': {
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
                }, 'kind': 'operand-expr'
            }, 'kind': 'operand-expr'
        })
    })

    describe('list init', () => {

        it('empty', () => {
            const ast = buildExpr(parseTree('[]'))
            expect(compactAstNode(ast)).toEqual({
                'kind': 'operand-expr',
                'operand': {
                    'kind': 'operand-expr',
                    'operand': {
                        'kind': 'operand-expr',
                        'operand': {
                            'kind': 'operand-expr',
                            'operand': {
                                'kind': 'list-expr',
                                'exprs': []
                            }
                        }
                    }
                }
            })
        })

        it('basic', () => {
            const ast = buildExpr(parseTree('[1, 2, 3]'))
            expect(compactAstNode(ast)).toEqual({
                'kind': 'operand-expr',
                'operand': {
                    'kind': 'operand-expr',
                    'operand': {
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
                    }
                }
            })
        })
    })

})
