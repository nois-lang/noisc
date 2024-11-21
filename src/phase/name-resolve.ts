import { AstNode, AstNodeKind } from '../ast'
import { Identifier, Name } from '../ast/operand'
import { TypeParam } from '../ast/type'
import {
    Context,
    Definition,
    Namespace,
    Scope,
    addDef,
    addError,
    defKey,
    idToString,
    makeScope,
    namespaces
} from '../scope'
import { genericError, notFoundError } from '../semantic/error'
import { unreachable } from '../util/todo'

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
            node.fields.forEach(fd => resolveName(fd, ctx))
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
        case 'fn-type': {
            resolveName(node.returnType, ctx)
            node.paramTypes.forEach(pt => resolveName(pt, ctx))
            node.typeParams.forEach(g => resolveName(g, ctx))
            break
        }
        case 'type-param': {
            const stack = m.scopeStack.at(-1)
            if (stack) {
                addDef(node, stack, ctx)
            }
            node.bounds.forEach(b => resolveName(b, ctx))
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
            node.fieldPatterns.forEach(fp => {
                const def = node.identifier.def
                fp.variant = def?.kind === 'variant' ? def : undefined
                resolveName(fp, ctx)
            })
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
            node.typeArgs.forEach(ta => {
                return resolveName(ta, ctx)
            })
            const def = findById(node, ctx)
            if (!def) {
                addError(ctx, notFoundError(ctx, node, idToString(node)), true)
                break
            }
            node.def = def
            break
        }
        case 'name': {
            const p = getParent(ctx)
            if (p?.kind === 'pattern' || p?.kind === 'field-pattern') {
                const stack = m.scopeStack.at(-1)
                if (stack) {
                    addDef(node, stack, ctx)
                }
                break
            }
            unreachable(p?.kind)
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
            resolveName(node.op, ctx)
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
                node.typeParams.forEach(g => resolveName(g, ctx))
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
        case 'trait-def':
        case 'impl-def': {
            withScope(ctx, () => {
                if (!node.typeParams.find(g => g.name.value === 'Self')) {
                    const g: TypeParam = {
                        kind: 'type-param',
                        name: { kind: 'name', value: 'Self' },
                        parseNode: node.kind === 'trait-def' ? node.name.parseNode : node.trait.parseNode,
                        bounds: []
                    }
                    g.name.def = g
                    node.typeParams.unshift(g)
                }
                node.typeParams.forEach(g => resolveName(g, ctx))
                if (node.kind === 'impl-def') {
                    resolveName(node.trait, ctx)
                    resolveName(node.for, ctx)
                }
                if (node.block) {
                    resolveName(node.block, ctx)
                }
            })
            break
        }
        case 'type-def': {
            withScope(ctx, () => {
                node.typeParams.forEach(g => resolveName(g, ctx))
                node.variants.forEach(v => resolveName(v, ctx))
            })
            break
        }
        case 'field-def': {
            resolveName(node.fieldType, ctx)
            break
        }
        case 'compose-op': {
            addError(ctx, genericError(ctx, node), true)

            unreachable()
            break
        }
        case 'call-op': {
            node.args.forEach(a => resolveName(a, ctx))
            break
        }
    }
    m.astStack.pop()
}

export const findName = (name: string, ctx: Context, ns?: Namespace[]): Definition | undefined => {
    const m = ctx.moduleStack.at(-1)!
    for (const scope of [...m.scopeStack.toReversed(), m.topScope, m.useScope, ctx.prelude!.useScope!]) {
        const def = findNameInScope(name, scope, ns)
        if (def) return def
    }
    return undefined
}

export const findById = (id: Identifier, ctx: Context): Definition | undefined => {
    const def = findName(id.names[0].value, ctx, id.names.length > 1 ? ['module', 'type'] : undefined)
    if (!def || id.names.length === 1) return def
    if (id.names.length > 2) {
        addError(ctx, genericError(ctx, def))
        return undefined
    }
    return findWithinDef(def, id.names[1], ctx)
}

export const findNameInScope = (
    name: string,
    scope: Scope,
    ns: Namespace[] = [...namespaces]
): Definition | undefined => {
    for (const n of ns) {
        const def = scope[n].get(name)
        if (def) return def
    }
    return undefined
}

export const findParent = (ctx: Context, ofKind: AstNodeKind[]): AstNode | undefined => {
    const m = ctx.moduleStack.at(-1)!
    return m.astStack.toReversed().find(n => ofKind.includes(n.kind))
}
export const getParent = (ctx: Context): AstNode | undefined => {
    const m = ctx.moduleStack.at(-1)!
    return m.astStack.at(-2)!
}

const findWithinDef = (def: Definition, name: Name, ctx: Context): Definition | undefined => {
    const key = defKey(name)
    switch (def.kind) {
        case 'module': {
            return findNameInScope(name.value, def.topScope)
        }
        case 'trait-def': {
            return def.block.statements.find(s => defKey(s.name) === key)
        }
        case 'name': {
            return undefined
        }
        case 'type-param': {
            // TODO
            return undefined
        }
        default: {
            addError(ctx, genericError(ctx, def))
            return undefined
        }
    }
}

const withScope = <T>(ctx: Context, f: () => T): T => {
    const m = ctx.moduleStack.at(-1)!
    m.scopeStack.push(makeScope())
    const res = f()
    m.scopeStack.pop()
    return res
}
