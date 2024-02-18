import { existsSync, readFileSync, statSync } from 'fs'
import { basename, dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { parseOption } from './cli'
import { fromCmdFlags } from './config'
import { colorError, colorWarning, prettySourceMessage } from './error'
import { Package } from './package'
import { buildModule } from './package/build'
import { buildPackage } from './package/io'
import { getSpan } from './parser'
import { Context, pathToVid } from './scope'
import { buildInstanceRelations } from './scope/trait'
import { checkModule, checkTopLevelDefinition, prepareModule } from './semantic'
import { Source } from './source'

const dir = dirname(fileURLToPath(import.meta.url))
const version = JSON.parse(readFileSync(join(dir, '..', 'package.json')).toString()).version

export const usage = `\
Nois compiler v${version}

Usage: nois [OPTIONS] file
Options:
    --help                      Display this message
    --libCheck=<true|false>     Perform semantic checking on every source file. If \`false\`, only definitions required
                                by the main file will be checked (default \`false\`)
    --name=<name>               Compile package with this name
    --src=<path>                Source directory, relative to \`file\`
    --out=<path>                Compile directory, relative to \`file\`. Also used to lookup \`deps\`
    --deps=<pkg1,pkg2,..>       Comma separated list of dependency package names (including transitive), present in
                                compile directory
`

const pathArg = process.argv.at(-1)!
if (!pathArg || parseOption('help') !== undefined) {
    console.info(usage)
    process.exit()
}
const path = resolve(pathArg)

let pkg: Package
let lib: Package[]
if (!existsSync(path)) {
    console.error(`no such file \`${pathArg}\``)
    process.exit(1)
}
if (statSync(path).isDirectory()) {
    const pkgJsonPath = join(path, 'package.json')
    if (!existsSync(pkgJsonPath)) {
        console.error(`no such file \`${pkgJsonPath}\``)
        process.exit(1)
    }
    const src = parseOption('src') ?? 'src'
    const srcPath = join(path, src)
    if (!existsSync(srcPath)) {
        console.error(`no such file \`${srcPath}\``)
        process.exit(1)
    }
    const name = parseOption('name')
    if (name === undefined) {
        console.error(`missing required option \`--name=\``)
        process.exit(1)
    }
    const res = buildPackage(srcPath, name)
    if (!res) process.exit(1)
    pkg = res

    const out = parseOption('out') ?? 'dist'
    const outPath = join(path, out)
    const depsArg = parseOption('deps')
    const deps: string[] = depsArg !== undefined ? depsArg.split(',') : []
    lib = deps.map(depName => {
        const depPath = join(outPath, depName)
        if (!existsSync(depPath)) {
            console.error(`no such file \`${depPath}\``)
            process.exit(1)
        }
        const p = buildPackage(depPath, depName, true)
        if (!p) process.exit(1)
        return p
    })
} else {
    const source: Source = { code: readFileSync(path).toString(), filepath: path }
    const moduleAst = buildModule(source, pathToVid(basename(path)))
    if (!moduleAst) {
        process.exit(1)
    }
    pkg = {
        path: source.filepath,
        name: moduleAst.identifier.names.at(-1)!,
        modules: [moduleAst],
        compiled: false
    }
    lib = []
}

const std = buildPackage(join(dir, 'std'), 'std')
if (!std) {
    process.exit(1)
}

const ctx: Context = {
    config: fromCmdFlags(),
    moduleStack: [],
    packages: [std, ...lib, pkg],
    prelude: std.modules.find(m => m.identifier.names.at(-1)! === 'prelude')!,
    impls: [],
    errors: [],
    warnings: [],
    check: false,
    silent: false
}

ctx.packages.forEach(p => p.modules.forEach(m => prepareModule(m)))
ctx.impls = buildInstanceRelations(ctx)
ctx.impls.forEach(impl => checkTopLevelDefinition(impl.module, impl.instanceDef, ctx))
ctx.check = true
if (ctx.config.libCheck) {
    ctx.packages.flatMap(p => p.modules).forEach(m => checkModule(m, ctx))
} else {
    pkg.modules.forEach(m => checkModule(m, ctx))
}

if (ctx.errors.length > 0) {
    for (const error of ctx.errors) {
        console.error(
            prettySourceMessage(colorError(error.message), getSpan(error.node.parseNode), error.module.source)
        )
    }
    process.exit(1)
}

for (const warning of ctx.warnings) {
    console.error(
        prettySourceMessage(colorWarning(warning.message), getSpan(warning.node.parseNode), warning.module.source)
    )
}
