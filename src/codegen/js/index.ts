import { Module } from '../../ast'
import { Context } from '../../scope'
import { InstanceRelation, relTypeName } from '../../scope/trait'
import { concatVid, vidFromString } from '../../scope/util'
import { VirtualIdentifier } from '../../scope/vid'
import { Upcast } from '../../semantic/upcast'
import { VirtualType, virtualTypeToString } from '../../typecheck'
import { groupBy } from '../../util/array'
import { unreachable } from '../../util/todo'
import { EmitNode, EmitToken, emitToken, emitTree } from './node'
import { emitStatement } from './statement'

export interface JsImport {
    def: string
    path: string
}

export const emitModule = (module: Module, ctx: Context, main: boolean = false): EmitNode => {
    const statements = emitTree(
        module.block.statements.map(s => emitStatement(s, module, ctx)).map(s => ('resultVar' in s ? s.emit : s))
    )
    const mainStr = `try{main();}catch(e){console.error(\`\${e.message}\\n\${e.stack.split("\\n").slice(1).join("\\n")}\`);}`
    const mainFnInvoke = main ? emitToken(mainStr) : undefined
    const imports = emitImports(module, ctx)
    return emitTree([imports, statements, mainFnInvoke])
}

export const emitImports = (module: Module, ctx: Context): EmitNode => {
    const relImports = module.relImports
        .filter(i => i.module !== module)
        .map(i => makeJsImport(concatVid(i.module.identifier, vidFromString(jsRelName(i))), i.module, module, ctx))
    const imports_: JsImport[] = module.imports
        .filter(i => i.module !== module)
        .map(i => {
            let vid = i.vid
            // variant constructors are always accessible from type reference, e.g. `Option.Some`, so only `Option`
            // needs to be imported
            if (i.def.kind === 'variant') {
                vid = { names: [...i.module.identifier.names, i.def.typeDef.name.value] }
            }
            return makeJsImport(vid, i.module, module, ctx)
        })
    imports_.push(...relImports)
    const imports = [...groupBy(imports_, i => i.path).entries()].map(([path, is]) => {
        const defs = [...new Set(is.map(i => i.def))].toSorted()
        return emitToken(`import{${defs.join(',')}}from"${path}.js";`)
    })
    return emitTree(imports)
}

const makeJsImport = (vid: VirtualIdentifier, importModule: Module, module: Module, ctx: Context): JsImport => {
    const importPkg = vid.names[0]
    const modulePkg = ctx.packages.find(p => p.modules.find(m => m === module))!.name
    const def = vid.names.at(-1)!
    if (importPkg === modulePkg) {
        const root = ['.', ...new Array(module.identifier.names.length - (module.mod ? 1 : 2)).fill('..')]
        return { def, path: [...root, ...vid.names.slice(1, -1), ...(importModule.mod ? ['mod'] : [])].join('/') }
    }
    return { def, path: [...vid.names.slice(0, -1), ...(importModule.mod ? ['mod'] : [])].join('/') }
}

export const emitUpcasts = (resultVar: string, upcasts: Upcast[] | undefined): EmitToken | undefined => {
    if (!upcasts || upcasts.length === 0) return undefined
    return emitToken(upcasts.map(u => emitUpcast(resultVar, u)).join(''))
}

const emitUpcast = (resultVar: string, upcast: Upcast): string | undefined => {
    if (Object.keys(upcast.self).length === 0 && upcast.generics.length === 0) return undefined
    return `${resultVar}.upcast(${resultVar}, ...${upcastToArgString(upcast)});`
}

const upcastToArgString = (upcast: Upcast): string => {
    if (Object.keys(upcast.self).length === 0) return ''
    const gs = upcast.generics.length > 0 ? upcast.generics.map(upcastToArgString).join('') : ''
    const self = `{${Object.entries(upcast.self).map(([k, v]) => `${jsString(k)}:${jsRelName(v)}`)}}`
    return `[${[self, gs].filter(t => t.length > 0).join(',')}]`
}

export const extractValue = (str: string): string => {
    return `${str}.value`
}

export const jsString = (str: string): string => {
    return JSON.stringify(str)
}

export const nextVariable = (ctx: Context): string => {
    ctx.variableCounter++
    return `$${ctx.variableCounter}`
}

export const jsRelName = (rel: InstanceRelation): string => {
    if (rel.instanceDef.kind === 'trait-def') {
        return relTypeName(rel)
    }
    if (rel.inherent) {
        return `impl_${virtualTypeToString(rel.implType)}`.replace(/[:<>, ]/g, '')
    }
    return `impl_${virtualTypeToString(rel.implType)}_${virtualTypeToString(rel.forType)}`.replace(/[:<>, ]/g, '')
}

export const jsGenericTypeName = (type: VirtualType): string => {
    switch (type.kind) {
        case 'generic':
            return type.name
        case 'vid-type':
            return type.identifier.names.at(-1)!
        case 'hole-type':
            return 'undefined'
        case 'fn-type':
        case 'unknown-type':
        case 'malleable-type':
            return unreachable(type.kind)
    }
}

export const indentStr = (str: string, level = 1): string => {
    return str.replace(/^/gm, ' '.repeat(4 * level))
}
