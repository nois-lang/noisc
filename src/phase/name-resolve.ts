import { AstNode, AstNodeKind } from '../ast'
import { Name } from '../ast/operand'
import { Context, Definition, DefinitionMap, defKey } from '../scope'

/**
 * Resolve every name to its definition
 */
export const resolveName = (node: AstNode, ctx: Context): void => {
    const m = ctx.moduleStack.at(-1)!
    m.astStack.push(node)
    switch (node.kind) {
        case 'module': {
            for (const statement of node.block.statements) {
                resolveName(statement, ctx)
            }
            break
        }
        case 'variant': {
            node.fieldDefs.forEach(fd => resolveName(fd, ctx))
            break
        }
        case 'arg': {
            resolveName(node.expr, ctx)
            break
        }
        case 'block': {
            withScope(ctx, () => node.statements.forEach(s => resolveName(s, ctx)))
            break
        }
        case 'param': {
            resolveName(node.pattern, ctx)
            if (node.paramType) {
                resolveName(node.paramType, ctx)
            }
            break
        }
        case 'type-bounds': {
            node.bounds.forEach(b => resolveName(b, ctx))
            break
        }
        case 'fn-type': {
            resolveName(node.returnType, ctx)
            node.paramTypes.forEach(pt => resolveName(pt, ctx))
            node.generics.forEach(g => resolveName(g, ctx))
            break
        }
        case 'generic': {
            node.bounds.forEach(b => resolveName(b, ctx))
            break
        }
        case 'if-expr': {
            resolveName(node.condition, ctx)
            resolveName(node.thenBlock, ctx)
            if (node.elseBlock) {
                resolveName(node.elseBlock, ctx)
            }
            break
        }
        case 'match-clause': {
            withScope(ctx, () => {
                node.patterns.forEach(p => resolveName(p, ctx))
                if (node.guard) {
                    resolveName(node.guard, ctx)
                }
                resolveName(node.block, ctx)
            })
            break
        }
        case 'pattern': {
            resolveName(node.expr, ctx)
            if (node.name) {
                resolveName(node.name, ctx)
            }
            break
        }
        case 'con-pattern': {
            resolveName(node.identifier, ctx)
            node.fieldPatterns.forEach(fp => resolveName(fp, ctx))
            break
        }
        case 'list-pattern': {
            node.itemPatterns.forEach(ip => resolveName(ip, ctx))
            break
        }
        case 'field-pattern': {
            if (node.pattern) {
                resolveName(node.pattern, ctx)
            }
            if (node.name) {
                resolveName(node.name, ctx)
            }
            break
        }
        case 'identifier': {
            node.typeArgs.forEach(ta => resolveName(ta, ctx))
            const def = findName(node.names[0], ctx)
            if (!def) {
                // TODO: report error
                break
            }
            // TODO: check other names
            break
        }
        case 'name': {
            if (findParent(ctx, ['pattern'])) {
                addDef(node.value, node, ctx)
            } else {
                const def = findName(node, ctx)
                if (!def) {
                    // TODO: report error
                    break
                }
                node.def = def
            }
            break
        }
        case 'string-interpolated': {
            node.tokens.map(t => {
                if (typeof t !== 'string') {
                    resolveName(t, ctx)
                }
            })
            break
        }
        case 'operand-expr': {
            resolveName(node.operand, ctx)
            break
        }
        case 'unary-expr': {
            resolveName(node.operand, ctx)
            resolveName(node.op, ctx)
            break
        }
        case 'binary-expr': {
            resolveName(node.lOperand, ctx)
            resolveName(node.rOperand, ctx)
            resolveName(node.binaryOp, ctx)
            break
        }
        case 'closure-expr': {
            withScope(ctx, () => {
                node.params.forEach(p => resolveName(p, ctx))
                if (node.returnType) {
                    resolveName(node.returnType, ctx)
                }
                resolveName(node.block, ctx)
            })
            break
        }
        case 'list-expr': {
            node.exprs.forEach(e => resolveName(e, ctx))
            break
        }
        case 'while-expr': {
            resolveName(node.condition, ctx)
            resolveName(node.block, ctx)
            break
        }
        case 'for-expr': {
            withScope(ctx, () => {
                resolveName(node.pattern, ctx)
                resolveName(node.expr, ctx)
                resolveName(node.block, ctx)
            })
            break
        }
        case 'match-expr': {
            resolveName(node.expr, ctx)
            node.clauses.forEach(c => resolveName(c, ctx))
            break
        }
        case 'var-def': {
            resolveName(node.pattern, ctx)
            if (node.expr) {
                resolveName(node.expr, ctx)
            }
            if (node.varType) {
                resolveName(node.varType, ctx)
            }
            break
        }
        case 'fn-def': {
            withScope(ctx, () => {
                node.generics.forEach(g => resolveName(g, ctx))
                node.params.forEach(p => resolveName(p, ctx))
                if (node.returnType) {
                    resolveName(node.returnType, ctx)
                }
                if (node.block) {
                    resolveName(node.block, ctx)
                }
            })
            break
        }
        case 'trait-def': {
            withScope(ctx, () => {
                node.generics.forEach(g => resolveName(g, ctx))
                if (node.block) {
                    resolveName(node.block, ctx)
                }
            })
            break
        }
        case 'impl-def': {
            withScope(ctx, () => {
                node.generics.forEach(g => resolveName(g, ctx))
                resolveName(node.identifier, ctx)
                if (node.forTrait) {
                    resolveName(node.forTrait, ctx)
                }
                if (node.block) {
                    resolveName(node.block, ctx)
                }
            })
            break
        }
        case 'type-def': {
            withScope(ctx, () => {
                node.generics.forEach(g => resolveName(g, ctx))
                node.variants.forEach(v => resolveName(v, ctx))
            })
            break
        }
        case 'field-def': {
            resolveName(node.fieldType, ctx)
            break
        }
        case 'method-call-op': {
            resolveName(node.call, ctx)
            node.typeArgs.forEach(a => resolveName(a, ctx))
            // methods are checked after type resolution since types are not known yet
            break
        }
        case 'field-access-op': {
            // fields are checked after type resolution since types are not known yet
            break
        }
        case 'call-op': {
            node.args.forEach(a => resolveName(a, ctx))
            break
        }
    }
    m.astStack.pop()
}

const addDef = (name: string, def: Definition, ctx: Context): void => {
    const m = ctx.moduleStack.at(-1)!
    const scope = m.scopeStack.at(-1) ?? m.topScope
    if (scope.has(name)) {
        // TODO: error
    }
    scope.set(name, def)
}

const findParent = (ctx: Context, ofKind: AstNodeKind[]): AstNode | undefined => {
    const m = ctx.moduleStack.at(-1)!
    return m.astStack.toReversed().find(n => ofKind.includes(n.kind))
}

const findName = (name: Name, ctx: Context): Definition | undefined => {
    const m = ctx.moduleStack.at(-1)!
    for (const stack of [...m.scopeStack.toReversed(), m.topScope]) {
        const def = findNameInStack(name, stack)
        if (def) return def
    }
    return undefined
}
const findNameInStack = (name: Name, stack: DefinitionMap): Definition | undefined => {
    return stack.get(defKey(name))
}

const withScope = <T>(ctx: Context, f: () => T): T => {
    const m = ctx.moduleStack.at(-1)!
    m.scopeStack.push(new Map())
    const res = f()
    m.scopeStack.pop()
    return res
}
