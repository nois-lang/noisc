import { Module } from '../ast'
import { FnDef, ImplDef, KindDef } from '../ast/statement'
import { isAssignable, typeToVirtual, VirtualType } from '../typecheck'
import { Definition, VirtualIdentifier } from './vid'
import { Config } from '../config'
import { SemanticError } from '../semantic/error'

export interface Context {
    config: Config
    moduleStack: Module[]
    modules: Module[]
    errors: SemanticError[]
    warnings: SemanticError[]
}

export type Scope = KindScope | ImplScope | CommonScope

export interface KindScope {
    type: 'kind-def',
    kindDef: KindDef,
    definitions: Map<string, Definition>
}

export interface ImplScope {
    type: 'impl-def',
    implDef: ImplDef,
    definitions: Map<string, Definition>
}

export interface CommonScope {
    type: 'module' | 'fn-def' | 'type-def' | 'block',
    definitions: Map<string, Definition>
}

export const findImpl = (vId: VirtualIdentifier, type: VirtualType, ctx: Context): ImplDef | undefined => {
    // TODO: go through imports only
    return ctx.modules
        .flatMap(m => m.block.statements.filter(s => s.kind === 'impl-def').map(s => <ImplDef>s))
        .filter(i => !i.forKind || isAssignable(type, typeToVirtual(i.forKind), ctx))
        .find(i => i.name.value === vId.name)
}

export const findImplFn = (implDef: ImplDef, vid: VirtualIdentifier, ctx: Context): FnDef | undefined => {
    return implDef.block.statements
        .filter(s => s.kind === 'fn-def' && s.name.value === vid.name)
        .map(s => <FnDef>s).at(0)
}

export const pathToVid = (path: string, packageName?: string): VirtualIdentifier => {
    const dirs = path.replace(/\.no$/, '').split('/')
    if (packageName) {
        dirs.unshift(packageName)
    }
    if (dirs.at(-1)!.toLowerCase() === 'mod') {
        dirs.pop()
    }
    const scope = dirs.slice(0, -1)
    const name = dirs.at(-1)!
    return { scope, name }
}

/**
 * Checks whether current module scopeStack is within ImplDef or KindDef scope
 */
export const instanceScope = (ctx: Context): Scope | undefined => {
    const module = ctx.moduleStack.at(-1)!
    for (let i = module.scopeStack.length - 1; i >= 0; i--) {
        let scope = module.scopeStack[i]
        if (scope.type === 'impl-def' || scope.type === 'kind-def') {
            return scope
        }
    }
    return undefined
}
