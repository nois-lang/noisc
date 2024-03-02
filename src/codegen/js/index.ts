import { Module } from '../../ast'
import { Context } from '../../scope'
import { vidFromScope } from '../../scope/util'
import { VirtualIdentifier } from '../../scope/vid'
import { groupBy } from '../../util/array'
import { emitExprToString } from './expr'
import { emitStatement } from './statement'

export interface JsImport {
    def: string
    path: string
}

export const emitModule = (module: Module, ctx: Context): string => {
    const statements = module.block.statements
        .map(s => emitStatement(s, module, ctx))
        .map(emitExprToString)
        .filter(s => s.length > 0)
        .join('\n\n')
    return [emitImports(module, ctx), statements].filter(s => s.length > 0).join('\n\n')
}

export const emitImports = (module: Module, ctx: Context): string => {
    const imports_: JsImport[] = module.imports
        .filter(i => i.module !== module)
        .map(i => {
            let vid = i.vid
            // variant constructors are always accessible from type reference, e.g. `Option.Some`, so only `Option`
            // needs to be imported
            if (i.def.kind === 'variant') {
                vid = vidFromScope(vid)
            }
            return makeJsImport(vid, i.module, module, ctx)
        })
    const imports = [...groupBy(imports_, i => i.path).entries()]
        .map(([path, is]) => {
            const defs = [...new Set(is.map(i => i.def))].toSorted()
            return `import { ${defs.join(', ')} } from "${path}.js";`
        })
        .join('\n')
    return imports
}

const makeJsImport = (vid: VirtualIdentifier, importModule: Module, module: Module, ctx: Context): JsImport => {
    const importPkg = vid.names[0]
    const modulePkg = ctx.packages.find(p => p.modules.find(m => m === module))!.name
    const def = vid.names.at(-1)!
    if (importPkg === modulePkg) {
        const root = ['.', ...new Array(module.identifier.names.length - 2).fill('..')]
        return { def, path: [...root, ...vid.names.slice(1, -1), ...(importModule.mod ? ['mod'] : [])].join('/') }
    }
    return { def, path: [...vid.names.slice(0, -1), ...(importModule.mod ? ['mod'] : [])].join('/') }
}

export const extractValue = (str: string): string => {
    return `${str}.value`
}

export const jsString = (str: string): string => {
    return JSON.stringify(str)
}

export const jsVariable = (name: string, emit: string): string => {
    return `const ${name} = ${emit};`
}

export const indent = (str: string, level = 1): string => {
    return str.replace(/^/gm, ' '.repeat(4 * level))
}

export const nextVariable = (ctx: Context): string => {
    ctx.variableCounter++
    return `$${ctx.variableCounter}`
}

export const jsTodo = (message?: string): string => {
    const msg = 'todo' + (message ? `: ${message}` : '')
    return `Error(${jsString(msg)})`
}
