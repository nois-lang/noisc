import { AstNode } from '../ast'
import { UnaryExpr } from '../ast/expr'
import { TypeParam } from '../ast/type'
import { Context, addError, idFromString } from '../scope'
import { genericError } from '../semantic/error'
import { assign } from '../util/object'
import { assert } from '../util/todo'

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
                    desugarComposeOp(node, ctx)
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
                desugar(node.block, stage, ctx)
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
        case 'arg': {
            desugar(node.expr, stage, ctx)
            break
        }
        case 'compose-op': {
            desugar(node.operand, stage, ctx)
            break
        }
        case 'trait-def':
        case 'impl-def': {
            desugar(node.block, stage, ctx)

            if (stage === 'init') {
                if (!node.typeParams.find(g => g.name.value === 'Self')) {
                    const g: TypeParam = {
                        kind: 'type-param',
                        name: { kind: 'name', value: 'Self' },
                        parseNode: node.kind === 'trait-def' ? node.name.parseNode : node.trait.parseNode,
                        bounds: []
                    }
                    node.typeParams.unshift(g)
                }
                const selfParam = node.typeParams.find(g => g.name.value === 'Self')!
                switch (node.kind) {
                    case 'trait-def':
                        selfParam.bounds.push({
                            kind: 'identifier',
                            parseNode: node.parseNode,
                            names: [node.name],
                            typeArgs: []
                        })
                        break
                    case 'impl-def':
                        selfParam.bounds.push(node.for)
                        break
                }
            }
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
        case 'list-expr': {
            node.exprs.forEach(expr => desugar(expr, stage, ctx))
            break
        }
        case 'while-expr': {
            desugar(node.condition, stage, ctx)
            desugar(node.block, stage, ctx)
            break
        }
        case 'for-expr': {
            desugar(node.pattern, stage, ctx)
            desugar(node.expr, stage, ctx)
            desugar(node.block, stage, ctx)
            break
        }
        case 'use-expr':
        case 'variant':
        case 'return-stmt':
        case 'break-stmt':
        case 'param':
        case 'fn-type':
        case 'param-type':
        case 'type-param':
        case 'pattern':
        case 'con-pattern':
        case 'list-pattern':
        case 'field-pattern':
        case 'hole':
        case 'identifier':
        case 'name':
        case 'string-interpolated':
        case 'type-def':
        case 'field-def':
        case 'string-literal':
        case 'char-literal':
        case 'int-literal':
        case 'float-literal':
        case 'bool-literal':
        case 'add-op':
        case 'sub-op':
        case 'mult-op':
        case 'div-op':
        case 'exp-op':
        case 'mod-op':
        case 'eq-op':
        case 'ne-op':
        case 'ge-op':
        case 'le-op':
        case 'gt-op':
        case 'lt-op':
        case 'and-op':
        case 'or-op':
        case 'assign-op':
        case 'bind-op':
        case 'await-op':
            break
    }
}

export const desugarComposeOp = (node: UnaryExpr, ctx: Context) => {
    if (node.op.kind !== 'compose-op') return assert(false)
    const left = node.operand
    const right = node.op.operand
    if (right.kind === 'unary-expr' && right.op.kind === 'call-op') {
        // foo.bar(a, b, c) -> bar(foo, a, b, c)
        const newNode = right
        // TODO: report error if there are named args, e.g. foo.bar(a = 4)
        // since we cannot apply argument with a correnct name before typecheck phase
        right.op.args.unshift({ kind: 'arg', parseNode: left.parseNode, expr: left })
        assign(node, newNode)
    } else if (right.kind === 'operand-expr') {
        // foo.bar -> bar(foo)
        const newNode: UnaryExpr = {
            kind: 'unary-expr',
            parseNode: node.parseNode,
            operand: {
                kind: 'operand-expr',
                parseNode: right.operand.parseNode,
                operand: right.operand
            },
            op: {
                kind: 'call-op',
                parseNode: right.operand.parseNode,
                args: [{ kind: 'arg', parseNode: node.parseNode, expr: node.operand }]
            }
        }
        assign(node, newNode)
    } else {
        addError(ctx, genericError(ctx, node, 'unknown `compose-op` structure'), true)
    }
}
