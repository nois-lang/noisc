import { Module } from '../../ast'
import { Context } from '../../scope'
import { groupBy } from '../../util/array'

export const emitModule = (module: Module, ctx: Context): string => {
    return [emitImports(module, ctx)].join('\n\n')
}

export const emitImports = (module: Module, ctx: Context): string => {
    const imports_: { def: string; path: string }[] = module.imports
        .filter(i => i.module !== module)
        .map(i => ({
            // TODO: fails on variant imports
            def: i.vid.names.at(-1)!,
            path: [...i.vid.names.slice(0, -1), ...(i.module.mod ? ['mod'] : [])].join('/')
        }))
    const imports = [...groupBy(imports_, i => i.path).entries()]
        .map(([path, is]) => {
            const defs = [...new Set(is.map(i => i.def))].toSorted()
            return `import { ${defs.join(', ')} } from "${path}";`
        })
        .join('\n')
    return imports
}
