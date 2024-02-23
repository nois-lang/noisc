import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { basename, dirname, join, relative } from 'path'
import { fileURLToPath } from 'url'
import { parseOption } from './cli'
import { emitDeclaration } from './codegen/declaration'
import { fromCmd } from './config'
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

export const usageHeader = `Nois compiler v${version}`
export const usage = `\
${usageHeader}

Usage: noisc [OPTIONS] FILE
If FILE is a directory, compile files at FILE/<src> into FILE/<out> directory with <deps> in scope
If FILE is a source file, compile it into <out> directory
Options:
    --name=<name>               Compile package with this name
    --src=<path>                Source directory (default \`FILE/src\`)
    --lib=<path>                Library directory containing compiled dependencies (default \`FILE/dist\`)
    --out=<path>                Package compile directory (default \`<lib>/<name>\`)
    --deps=<pkg1,pkg2,..>       Comma separated list of dependency package names (including transitive), present in
                                <lib> (default \`\`)
    --libCheck=<true|false>     Perform semantic checking on every source file. If \`false\`, only definitions required
                                by the main file will be checked (default \`false\`)
    --help                      Display this message
    --version                   Display version information
`

if (parseOption('help') !== undefined) {
    console.info(usage)
    process.exit()
}
if (parseOption('version') !== undefined) {
    console.info(usageHeader)
    process.exit()
}
const config = fromCmd()

let pkg: Package
let lib: Package[]
if (!existsSync(config.pkgPath)) {
    console.error(`no such file \`${config.pkgPath}\``)
    process.exit(1)
}
if (statSync(config.pkgPath).isDirectory()) {
    const srcPath = join(config.pkgPath, config.srcPath)
    if (!existsSync(srcPath)) {
        console.error(`no such file \`${srcPath}\``)
        process.exit(1)
    }
    if (config.pkgName === undefined) {
        console.error(`missing required option \`--name=\``)
        process.exit(1)
    }
    const res = buildPackage(srcPath, config.pkgName)
    if (!res) process.exit(1)
    pkg = res

    const libPath = join(config.pkgPath, config.libPath)
    lib = config.deps.map(depName => {
        const depPath = join(libPath, depName)
        if (!existsSync(depPath)) {
            console.error(`no such file \`${depPath}\``)
            process.exit(1)
        }
        const p = buildPackage(depPath, depName, true)
        if (!p) process.exit(1)
        return p
    })
} else {
    const source: Source = { code: readFileSync(config.pkgPath).toString(), filepath: config.pkgPath }
    const moduleAst = buildModule(source, pathToVid(basename(config.pkgPath)))
    if (!moduleAst) {
        process.exit(1)
    }
    pkg = {
        path: source.filepath,
        name: moduleAst.identifier.names.at(-1)!,
        modules: [moduleAst],
        compiled: false
    }
    const std = buildPackage(join(dir, 'std'), 'std')
    if (!std) {
        process.exit(1)
    }
    lib = [std]
}

const packages = [...lib, pkg]

const std = packages.find(pkg => pkg.name === 'std')
if (!std) {
    console.error('module `std` not found')
    process.exit(1)
}

const ctx: Context = {
    config,
    moduleStack: [],
    packages,
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

if (!existsSync(config.outPath)) mkdirSync(config.outPath, { recursive: true })
pkg.modules.forEach(m => {
    const content = emitDeclaration(m)
    const modulePath = relative(config.srcPath, m.source.filepath)
    const moduleOutPath = join(config.outPath, modulePath)
    const parentDir = dirname(moduleOutPath)
    if (!existsSync(parentDir)) mkdirSync(parentDir)

    writeFileSync(moduleOutPath, content)
    console.info(`emit: declaration ${moduleOutPath}`)
})
