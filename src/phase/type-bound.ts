import { AstNode } from '../ast'
import { Identifier } from '../ast/operand'
import { Type } from '../ast/type'
import { Context } from '../scope'
import { operatorImplMap } from '../semantic/op'
import { InferredType, makeInferredType, makeKnownType } from '../typecheck'
import { boolId, charId, floatId, intId, stringId, unitId } from '../typecheck/type'
import { assert, unreachable } from '../util/todo'
import { findById } from './name-resolve'

/**
 * Set known types of public nodes
 */
export const setPubType = (node: AstNode, ctx: Context, parent?: AstNode) => {
    switch (node.kind) {
        case 'module': {
            node.block.statements.forEach(s => setPubType(s, ctx))
            break
        }
        case 'var-def': {
            if (node.pattern.expr.kind !== 'name') break
            const def = node.pattern.expr
            def.type = makeInferredType()
            setKnown(def.type, node.varType)
            break
        }
        case 'fn-def': {
            node.params.forEach(p => {
                p.type = makeInferredType()
                if (p.paramType) {
                    setKnown(p.type, p.paramType)
                }
            })
            node.type = makeInferredType()
            setKnown(node.type, {
                kind: 'fn-type',
                parseNode: node.name.parseNode,
                generics: node.generics,
                paramTypes: node.params.map(p => p.type!),
                returnType: node.returnType ?? unitId
            })
            break
        }
        case 'type-def': {
            // TODO: generics
            const nodeId: Identifier = {
                kind: 'identifier',
                parseNode: node.name.parseNode,
                names: [node.name],
                typeArgs: []
            }
            node.variants.forEach(v => {
                v.fieldDefs.forEach(f => {
                    f.type = makeInferredType()
                    setKnown(f.type, f.fieldType)
                })
                v.type = makeInferredType()
                setKnown(v.type, {
                    kind: 'fn-type',
                    parseNode: node.name.parseNode,
                    generics: node.generics,
                    paramTypes: v.fieldDefs.map(f => f.type!),
                    returnType: nodeId
                })
            })
            break
        }
        case 'trait-def':
        case 'impl-def': {
            if (node.kind === 'impl-def' && node.forTrait) break
            node.block.statements.forEach(s => setPubType(s, ctx, node))
            break
        }
    }
}

/**
 * Assign every suitable node its type and type bounds
 */
export const collectTypeBounds = (node: AstNode, ctx: Context, parentBound?: InferredType) => {
    switch (node.kind) {
        case 'variant':
        case 'return-stmt':
        case 'arg':
        case 'block':
        case 'param':
        case 'generic':
        case 'match-clause':
        case 'identifier':
        case 'name':
        case 'string-interpolated':
        case 'operand-expr':
        case 'unary-expr':
        case 'binary-expr':
        case 'closure-expr':
        case 'list-expr':
        case 'while-expr':
        case 'for-expr':
        case 'match-expr':
        case 'field-def':
        case 'string-literal':
        case 'char-literal':
        case 'int-literal':
        case 'float-literal':
        case 'bool-literal':
            node.type ??= makeInferredType()
    }
    if (node.type && parentBound) {
        addBounds(node.type, [parentBound])
    }
    switch (node.kind) {
        case 'module': {
            node.block.statements.forEach(s => collectTypeBounds(s, ctx))
            break
        }
        case 'variant': {
            // TODO
            break
        }
        case 'return-stmt': {
            // TODO
            break
        }
        case 'arg': {
            // TODO
            break
        }
        case 'block': {
            node.statements.forEach(s => collectTypeBounds(s, ctx))
            // TODO
            break
        }
        case 'param': {
            // TODO: handle self
            if (node.paramType) return undefined
            setKnown(node.type!, node.paramType)
            collectTypeBounds(node.pattern, ctx, node.paramType)
            return node.type
        }
        case 'generic': {
            // TODO
            break
        }
        case 'match-clause': {
            // TODO
            break
        }
        case 'pattern': {
            // TODO
            break
        }
        case 'con-pattern': {
            // TODO
            break
        }
        case 'list-pattern': {
            // TODO
            break
        }
        case 'field-pattern': {
            // TODO
            break
        }
        case 'hole': {
            // TODO
            break
        }
        case 'identifier':
        case 'name': {
            if (node.def) {
                if (
                    node.def.kind === 'trait-def' ||
                    node.def.kind === 'impl-def' ||
                    node.def.kind === 'type-def' ||
                    node.def.kind === 'module'
                )
                    return undefined
                node.def.type ??= makeInferredType()
                return node.def.type
            }
            // TODO
            break
        }
        case 'string-interpolated': {
            node.tokens.filter(t => typeof t !== 'string').forEach(t => collectTypeBounds(t, ctx))
            setKnown(node.type!, stringId)
            break
        }
        case 'operand-expr': {
            // TODO
            break
        }
        case 'unary-expr': {
            // TODO
            break
        }
        case 'binary-expr': {
            collectTypeBounds(node.lOperand, ctx)
            collectTypeBounds(node.rOperand, ctx)
            const methodId = operatorImplMap.get(node.binaryOp.kind)
            assert(!!methodId)
            const methodDef = findById(methodId!, ctx)
            assert(!!methodDef)
            const op = node.binaryOp
            op.type = makeInferredType()
            const fnType = methodDef!.type!.known!
            if (fnType.kind !== 'fn-type') {
                return unreachable()
            }
            setKnown(op.type, fnType)
            addBounds(op.type, [makeKnownType(boundFromCall([node.lOperand.type!, node.rOperand.type!]))])
            setKnown(node.type!, fnType.returnType)
            break
        }
        case 'closure-expr': {
            // TODO
            break
        }
        case 'list-expr': {
            // TODO
            break
        }
        case 'while-expr': {
            // TODO
            break
        }
        case 'for-expr': {
            // TODO
            break
        }
        case 'match-expr': {
            // TODO
            break
        }
        case 'var-def': {
            if (node.expr) {
                collectTypeBounds(node.expr, ctx)
            }
            collectTypeBounds(node.pattern, ctx, node.expr?.type)
            break
        }
        case 'fn-def': {
            if (node.block) {
                collectTypeBounds(node.block, ctx)
            }
            // TODO
            break
        }
        case 'trait-def': {
            // TODO
            break
        }
        case 'impl-def': {
            // TODO
            break
        }
        case 'string-literal': {
            setKnown(node.type!, stringId)
            break
        }
        case 'char-literal': {
            setKnown(node.type!, charId)
            break
        }
        case 'int-literal': {
            setKnown(node.type!, intId)
            break
        }
        case 'float-literal': {
            setKnown(node.type!, floatId)
            break
        }
        case 'bool-literal': {
            setKnown(node.type!, boolId)
            break
        }
        case 'method-call-op': {
            // TODO
            break
        }
        case 'field-access-op': {
            // TODO
            break
        }
        case 'call-op': {
            // TODO
            break
        }
        case 'unwrap-op': {
            // TODO
            break
        }
        case 'bind-op': {
            // TODO
            break
        }
        case 'await-op': {
            // TODO
            break
        }
    }
    return node.type
}

export const setKnown = (type: InferredType, known?: Type): void => {
    if (type.kind === 'inferred') {
        type.known = known
        return
    }
    assert(false, type.kind)
}

const addBounds = (type: InferredType, bounds: InferredType[]): void => {
    if (type.kind === 'inferred') {
        type.bounds.push(...bounds)
        return
    }
    assert(false, type.kind)
}

const boundFromCall = (args: Type[]): Type => {
    return { kind: 'fn-type', generics: [], paramTypes: args, returnType: { kind: 'hole' } }
}
