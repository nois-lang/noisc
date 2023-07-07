/**
 * Glancing means to briefly check module's top level statement's correctness and assign their types.
 * Glancing has to be done separately and before semantic check because some checks might require types of nodes from
 * a separate module.
 *
 * If glancing needs to lookup into another module that has not been glanced yet, it will recursively descend into it.
 * In case of a circular module reference, error will be thrown
 */

import { Module } from '../ast'
import { Context, semanticError } from '../scope'
import { vidFromString, vidToString } from '../scope/vid'
import { FnDef, ImplDef, KindDef, Statement, VarDef } from '../ast/statement'
import { TypeDef } from '../ast/type-def'
import { genericToVirtual, typeToVirtual, unitType, VirtualType } from '../typecheck'
import { identifyType } from './identify'

export const glanceModule = (module: Module, ctx: Context) => {
    if (module.glanced) return
    const vid = vidToString(module.identifier)
    if (ctx.moduleStack.some(m => vidToString(m.identifier) === vid)) {
        const stackVids = ctx.moduleStack.map(m => vidToString(m.identifier))
        const refChain = [...stackVids.slice(stackVids.indexOf(vid)), vid].join(' -> ')
        ctx.errors.push(semanticError(ctx, module, `circular module reference: ${refChain}`))
    }
    ctx.moduleStack.push(module)

    module.block.statements.forEach(s => glanceStatement(s, ctx))

    ctx.moduleStack.pop()
    module.glanced = true
}

const glanceStatement = (statement: Statement, ctx: Context) => {
    switch (statement.kind) {
        case 'var-def':
            glanceVarDef(statement, ctx)
            break
        case 'fn-def':
            glanceFnDef(statement, ctx)
            break
        case 'kind-def':
            glanceKindDef(statement, ctx)
            break
        case 'impl-def':
            glanceImplDef(statement, ctx)
            break
        case 'type-def':
            glanceTypeDef(statement, ctx)
            break
        default:
            ctx.errors.push(semanticError(ctx, statement, `top level \`${statement.kind}\` is not allowed`))
    }
}

const glanceVarDef = (varDef: VarDef, ctx: Context) => {
    // todo
}

const glanceFnDef = (fnDef: FnDef, ctx: Context) => {
    const module = ctx.moduleStack.at(-1)!

    const generics = fnDef.generics.map(genericToVirtual)
    if (module.implDef || module.kindDef) {
        generics.unshift({ name: 'Self', bounds: [] })
    }
    const paramTypes: VirtualType[] = fnDef.params.map((p, i) => {
        if (!p.paramType) {
            if ((module.implDef || module.kindDef)
                && i === 0
                && p.pattern.kind === 'name'
                && p.pattern.value === 'self') {
                return { kind: 'variant-type', identifier: vidFromString('Self'), typeParams: [] }
            } else {
                ctx.errors.push(semanticError(ctx, p, 'parameter type not specified'))
                return { kind: 'any-type' }
            }
        } else {
            identifyType(p.paramType, ctx)
            return typeToVirtual(p.paramType)
        }
    })
    if (paramTypes.some(p => p.kind === 'any-type')) return

    fnDef.type = {
        kind: 'fn-type',
        generics,
        paramTypes: paramTypes.map(p => p!),
        returnType: fnDef.returnType ? typeToVirtual(fnDef.returnType) : unitType
    }

    if (!fnDef.block) {
        if (!module.kindDef) {
            ctx.warnings.push(semanticError(ctx, fnDef, 'missing function body, must be a native function'))
        }
    }
}

const glanceKindDef = (kindDef: KindDef, ctx: Context) => {
    const module = ctx.moduleStack.at(-1)!
    module.kindDef = kindDef

    kindDef.block.statements.forEach(s => {
        if (s.kind !== 'fn-def') {
            ctx.errors.push(semanticError(ctx, s, `\`${s.kind}\` in kind definition is not allowed`))
            return
        }

        glanceFnDef(s, ctx)
    })

    module.kindDef = undefined
}

const glanceImplDef = (implDef: ImplDef, ctx: Context) => {
    const module = ctx.moduleStack.at(-1)!
    module.implDef = implDef

    implDef.block.statements.forEach(s => {
        if (s.kind !== 'fn-def') {
            ctx.errors.push(semanticError(ctx, s, `\`${s.kind}\` in impl definition is not allowed`))
            return
        }

        glanceFnDef(s, ctx)
    })

    module.implDef = undefined
}

const glanceTypeDef = (typeDef: TypeDef, ctx: Context) => {
    // todo
}
