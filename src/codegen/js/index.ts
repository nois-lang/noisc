import { Module } from '../../ast'
import { Context } from '../../scope'
import { InstanceRelation } from '../../scope/trait'
import { concatVid, vidFromScope, vidFromString } from '../../scope/util'
import { VirtualIdentifier } from '../../scope/vid'
import { virtualTypeToString } from '../../typecheck'
import { groupBy } from '../../util/array'
import { emitExprToString } from './expr'
import { emitStatement } from './statement'

export interface JsImport {
    def: string
    path: string
}

export const emitModule = (module: Module, ctx: Context, mainFn?: string): string => {
    const imports = emitImports(module, ctx)
    const statements = module.block.statements
        .map(s => emitStatement(s, module, ctx))
        .map(emitExprToString)
        .filter(s => s.length > 0)
        .join('\n\n')
    const mainFnInvoke =
        mainFn !== undefined
            ? [
                  `\
try {
    ${mainFn}();
} catch (e) {
    console.error(\`\${e.message}\\n\${e.stack.map(s => "    at " + s).join("\\n")}\`);
}`
              ]
            : []
    return [imports, statements, ...mainFnInvoke].filter(s => s.length > 0).join('\n\n')
}

export const emitImports = (module: Module, ctx: Context): string => {
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
                vid = vidFromScope(vid)
            }
            return makeJsImport(vid, i.module, module, ctx)
        })
    imports_.push(...relImports)
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
        const root = ['.', ...new Array(module.identifier.names.length - (module.mod ? 1 : 2)).fill('..')]
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

export const jsVariable = (name: string, emit?: string, pub = false): string => {
    const assign = emit !== undefined ? `const ${name} = ${emit};` : `let ${name}`
    return `${pub ? 'export ' : ''}${assign}`
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

export const jsRelName = (rel: InstanceRelation): string => {
    if (rel.inherent) {
        return `impl${virtualTypeToString(rel.implType)}`.replace(/[:<>,]/g, '')
    } else {
        return `impl${virtualTypeToString(rel.implType)}${virtualTypeToString(rel.forType)}`.replace(/[:<>,]/g, '')
    }
}
