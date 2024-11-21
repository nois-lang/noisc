import { AstNode } from '../ast'
import { UnaryExpr } from '../ast/expr'
import { Context, idFromString } from '../scope'
import { assign } from '../util/object'
import { todo } from '../util/todo'

export type DesugarStage = 'init' | 'pre-name-resolve'

/**
 * Desugar phase
 */
export const desugar = (node: AstNode, stage: DesugarStage, ctx: Context) => {
    switch (node.kind) {
        case 'module': {
            desugar(node.block, stage, ctx)
            break
        }
        case 'block': {
            node.statements.forEach(s => desugar(s, stage, ctx))
            break
        }
        case 'var-def': {
            if (node.expr) {
                desugar(node.expr, stage, ctx)
            }
            break
        }
        case 'operand-expr': {
            desugar(node.operand, stage, ctx)
            break
        }
        case 'unary-expr': {
            desugar(node.operand, stage, ctx)
            desugar(node.op, stage, ctx)

            if (stage === 'init') {
                if (node.op.kind === 'compose-op') {
                    if (node.operand.kind === 'unary-expr' && node.operand.op.kind === 'call-op') {
                        // foo.bar(a, b, c) -> bar(foo, a, b, c)
                        const newNode = node.operand.op
                        // TODO: report error if there are named args, e.g. foo.bar(a = 4)
                        // since we cannot apply argument with a correnct name before typecheck phase
                        newNode.args.unshift({ kind: 'arg', parseNode: node.operand.parseNode, expr: node.operand })
                        assign(node, newNode)
                    } else if (node.operand.kind === 'operand-expr' && node.operand.operand.kind === 'identifier') {
                        // foo.bar -> bar(foo)
                        const newNode: UnaryExpr = {
                            kind: 'unary-expr',
                            operand: {
                                kind: 'operand-expr',
                                parseNode: node.op.operand.parseNode,
                                operand: node.op.operand
                            },
                            op: {
                                kind: 'call-op',
                                parseNode: node.parseNode,
                                args: [{ kind: 'arg', parseNode: node.operand.parseNode, expr: node.operand }]
                            }
                        }
                        assign(node, newNode)
                    } else {
                        // foo.{bar} -> fn() { bar(foo)) }
                        todo('complex compose-op')
                    }
                }
            }

            break
        }
        case 'binary-expr': {
            desugar(node.lOperand, stage, ctx)
            desugar(node.rOperand, stage, ctx)
            desugar(node.op, stage, ctx)
            break
        }
        case 'fn-def': {
            if (node.block) {
                node.block.statements.forEach(s => desugar(s, stage, ctx))
            }
            break
        }
        case 'match-expr': {
            desugar(node.expr, stage, ctx)
            node.clauses.forEach(clause => desugar(clause, stage, ctx))
            break
        }
        case 'match-clause': {
            desugar(node.block, stage, ctx)
            break
        }
        case 'call-op': {
            node.args.forEach(arg => desugar(arg, stage, ctx))
            break
        }
        case 'trait-def':
        case 'impl-def': {
            desugar(node.block, stage, ctx)
            break
        }
        case 'trait-block': {
            node.statements.forEach(s => desugar(s, stage, ctx))
            break
        }
        case 'trait-statement': {
            desugar(node.expr, stage, ctx)

            if (stage === 'pre-name-resolve') {
                if (node.expr.kind === 'operand-expr' && node.expr.operand.kind === 'fn-def') {
                    const fnDef = node.expr.operand
                    fnDef.params.forEach((p, i) => {
                        if (
                            i === 0 &&
                            !p.paramType &&
                            p.pattern.expr.kind === 'name' &&
                            p.pattern.expr.value === 'self'
                        ) {
                            const selfType = idFromString('Self')
                            selfType.parseNode = p.parseNode
                            p.paramType = selfType
                        }
                    })
                }
            }
            break
        }
    }
}
