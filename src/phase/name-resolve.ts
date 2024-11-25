import { AstNode, AstNodeKind, Module } from '../ast'
import { Identifier, Name } from '../ast/operand'
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

/**
 * Resolve every name to its definition
 */
export const resolveName = (node: AstNode, ctx: Context, ns: Namespace[] = [...namespaces]): void => {
    const m = ctx.moduleStack.at(-1)!
    m.astStack.push(node)
    switch (node.kind) {
        case 'identifier': {
            node.typeArgs.forEach(ta => resolveName(ta, ctx, ['type']))
            const def = findById(node, ctx, ns)
            if (!def) {
                addError(ctx, notFoundError(ctx, node, idToString(node)))
                break
            }
            node.def = def
            break
        }
        case 'name': {
            const stack = m.scopeStack.at(-1)
            if (stack) {
                addDef(node, stack, ctx)
            }
            break
        }
        case 'module': {
            for (const statement of node.block.statements) {
                resolveName(statement, ctx, ns)
            }
            break
        }
        case 'variant': {
            node.fields.forEach(fd => resolveName(fd, ctx, ['value']))
            break
        }
        case 'arg': {
            resolveName(node.expr, ctx, ['value'])
            break
        }
        case 'block': {
            withScope(ctx, () => node.statements.forEach(s => resolveName(s, ctx, ns)))
            break
        }
        case 'param': {
            resolveName(node.pattern, ctx, ns)
            if (node.paramType) {
                resolveName(node.paramType, ctx, ['type'])
            }
            break
        }
        case 'fn-type': {
            const stack = m.scopeStack.at(-1)!
            node.typeParams.forEach(tp => addDef(tp, stack, ctx))
            node.typeParams.forEach(tp => tp.bounds.forEach(b => resolveName(b, ctx, ['type'])))

            resolveName(node.returnType, ctx, ns)
            node.params.forEach(pt => resolveName(pt, ctx, ns))
            break
        }
        case 'match-clause': {
            withScope(ctx, () => {
                node.patterns.forEach(p => resolveName(p, ctx, ns))
                if (node.guard) {
                    resolveName(node.guard, ctx, ns)
                }
                resolveName(node.block, ctx, ns)
            })
            break
        }
        case 'pattern': {
            resolveName(node.expr, ctx, ns)
            if (node.name) {
                resolveName(node.name, ctx, ns)
            }
            break
        }
        case 'con-pattern': {
            resolveName(node.identifier, ctx, ns)
            node.fieldPatterns.forEach(fp => {
                const def = node.identifier.def
                fp.variant = def?.kind === 'variant' ? def : undefined
                resolveName(fp, ctx, ns)
            })
            break
        }
        case 'list-pattern': {
            node.itemPatterns.forEach(ip => resolveName(ip, ctx, ns))
            break
        }
        case 'field-pattern': {
            if (node.pattern) {
                resolveName(node.pattern, ctx, ns)
            }
            if (node.name) {
                resolveName(node.name, ctx, ns)
            }
            break
        }
        case 'string-interpolated': {
            node.tokens.map(t => {
                if (typeof t !== 'string') {
                    resolveName(t, ctx, ns)
                }
            })
            break
        }
        case 'operand-expr': {
            resolveName(node.operand, ctx, ['value'])
            break
        }
        case 'unary-expr': {
            resolveName(node.operand, ctx, ['value'])
            resolveName(node.op, ctx, ns)
            break
        }
        case 'binary-expr': {
            resolveName(node.lOperand, ctx, ['value'])
            resolveName(node.rOperand, ctx, ['value'])
            resolveName(node.op, ctx, ns)
            break
        }
        case 'list-expr': {
            node.exprs.forEach(e => resolveName(e, ctx, ['value']))
            break
        }
        case 'while-expr': {
            resolveName(node.condition, ctx, ns)
            resolveName(node.block, ctx, ns)
            break
        }
        case 'for-expr': {
            withScope(ctx, () => {
                resolveName(node.pattern, ctx, ns)
                resolveName(node.expr, ctx, ns)
                resolveName(node.block, ctx, ns)
            })
            break
        }
        case 'match-expr': {
            resolveName(node.expr, ctx, ns)
            node.clauses.forEach(c => resolveName(c, ctx, ns))
            break
        }
        case 'var-def': {
            resolveName(node.pattern, ctx, ns)
            if (node.expr) {
                resolveName(node.expr, ctx, ns)
            }
            if (node.varType) {
                resolveName(node.varType, ctx, ['type'])
            }
            break
        }
        case 'fn-def': {
            withScope(ctx, () => {
                const stack = m.scopeStack.at(-1)!
                node.typeParams.forEach(tp => addDef(tp, stack, ctx))
                node.typeParams.forEach(tp => tp.bounds.forEach(b => resolveName(b, ctx, ['type'])))

                node.params.forEach(p => resolveName(p, ctx, ns))
                if (node.returnType) {
                    resolveName(node.returnType, ctx, ['type'])
                }
                if (node.block) {
                    resolveName(node.block, ctx, ns)
                }
            })
            break
        }
        case 'trait-def':
        case 'impl-def': {
            withScope(ctx, () => {
                const stack = m.scopeStack.at(-1)!
                node.typeParams.forEach(tp => addDef(tp, stack, ctx))
                node.typeParams.forEach(tp => tp.bounds.forEach(b => resolveName(b, ctx, ['type'])))

                switch (node.kind) {
                    case 'trait-def':
                        resolveName(node.name, ctx, ns)
                        break
                    case 'impl-def':
                        resolveName(node.trait, ctx, ns)
                        resolveName(node.for, ctx, ns)
                        break
                }
                if (node.block) {
                    resolveName(node.block, ctx, ns)
                }
            })
            break
        }
        case 'trait-block': {
            withScope(ctx, () => node.statements.forEach(s => resolveName(s, ctx, ns)))
            break
        }
        case 'trait-statement': {
            resolveName(node.name, ctx, ns)
            resolveName(node.expr, ctx, ns)
            node.name.def = node
            break
        }
        case 'type-def': {
            withScope(ctx, () => {
                const stack = m.scopeStack.at(-1)!
                node.typeParams.forEach(tp => addDef(tp, stack, ctx))
                node.typeParams.forEach(tp => tp.bounds.forEach(b => resolveName(b, ctx, ['type'])))

                node.variants.forEach(v => resolveName(v, ctx, ns))
            })
            break
        }
        case 'field-def': {
            resolveName(node.fieldType, ctx, ['type'])
            break
        }
        case 'call-op': {
            node.args.forEach(a => resolveName(a, ctx, ['value']))
            break
        }
        case 'return-stmt': {
            resolveName(node.returnExpr, ctx, ns)
        }
    }
    m.astStack.pop()
}

export const findName = (
    name: string,
    ctx: Context,
    ns?: Namespace[],
    m: Module = ctx.moduleStack.at(-1)!
): Definition | undefined => {
    for (const scope of [...m.scopeStack.toReversed(), m.topScope, m.useScope, ctx.prelude!.useScope!]) {
        const def = findNameInScope(name, scope, ns)
        if (def) return def
    }
    return undefined
}

export const findById = (id: Identifier, ctx: Context, ns: Namespace[]): Definition | undefined => {
    const m = ctx.moduleStack.at(-1)!
    if (id.names.length === 1) {
        return findName(id.names[0].value, ctx, ns)
    } else {
        const moduleId = id.names
            .map(n => n.value)
            .slice(0, -1)
            .join('::')
        const module = findNameInScope(moduleId, m.useScope, ['module'])
        if (module && module.kind === 'module') {
            return findName(id.names.at(-1)!.value, ctx, ns, module)
        }
    }
    const def = findName(id.names[0].value, ctx, ns)
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
