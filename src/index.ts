import { existsSync, readFileSync, statSync } from 'fs'
import { basename, dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
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
Nois transpiler - v${version}

Usage: nois [OPTIONS] file
Options:
    -h, --help                  Display this message
    --libCheck==[true|false]    Perform semantic checking on every source file. If \`false\`, only definitions required
                                by the main file will be checked (default \`false\`)
`

const pathArg = process.argv.at(-1)!
if (!pathArg || process.argv.includes('--help') || process.argv.includes('-h')) {
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
    // TODO: proper package config parsing and validation
    const pkgConfig = JSON.parse(readFileSync(pkgJsonPath).toString())
    if (!('name' in pkgConfig)) {
        console.error(`no \`name\` property in \`${pkgConfig}\``)
        process.exit(1)
    }
    const srcPath = join(path, pkgConfig.src ?? 'src')
    if (!existsSync(srcPath)) {
        console.error(`no such file \`${srcPath}\``)
        process.exit(1)
    }
    const res = buildPackage(srcPath, pkgConfig.name)
    if (!res) process.exit(1)
    pkg = res

    const outPath = join(path, pkgConfig.out ?? 'dist')
    const deps: string[] = pkgConfig.dependencies ? Object.keys(pkgConfig.dependencies) : []
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
    config: fromCmdFlags(process.argv),
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
