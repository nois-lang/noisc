import { Parser, ParseTree } from '../parser/parser'
import { tokenize } from '../lexer/lexer'
import { parseModule } from '../parser/fns'
import { compactAstNode } from './index'
import { buildExpr } from './expr'

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
                    'binaryOp': { 'type': 'add-op' },
                    'lOperand': {
                        'operand': {
                            'operand': { 'type': 'int-literal', 'value': '1' },
                            'type': 'operand-expr'
                        }, 'type': 'operand-expr'
                    },
                    'rOperand': {
                        'binaryOp': { 'type': 'mult-op' },
                        'lOperand': {
                            'operand': {
                                'operand': { 'type': 'int-literal', 'value': '2' },
                                'type': 'operand-expr'
                            }, 'type': 'operand-expr'
                        },
                        'rOperand': {
                            'operand': {
                                'operand': { 'type': 'int-literal', 'value': '3' },
                                'type': 'operand-expr'
                            }, 'type': 'operand-expr'
                        },
                        'type': 'binary-expr'
                    },
                    'type': 'binary-expr'
                }, 'type': 'operand-expr'
            }, 'type': 'operand-expr'
        })
    })

})
