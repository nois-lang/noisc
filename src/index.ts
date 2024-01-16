import { existsSync, readFileSync } from 'fs'
import { basename, dirname, join, resolve } from 'path'
import * as process from 'process'
import { fileURLToPath } from 'url'
import { fromCmdFlags } from './config'
import { colorError, colorWarning, prettySourceMessage } from './error'
import { Package } from './package'
import { buildModule } from './package/build'
import { buildPackage } from './package/io'
import { getLocationRange } from './parser'
import { Context, pathToVid } from './scope'
import { buildInstanceRelations } from './scope/trait'
import { checkModule, prepareModule } from './semantic'
import { Source } from './source'

const dir = dirname(fileURLToPath(import.meta.url))
const version = JSON.parse(readFileSync(join(dir, '..', 'package.json')).toString()).version

export const usage = `\
Nois transpiler - v${version}

Usage: nois [OPTIONS] file
Options:
    -h, --help                  Display this message
    --typeCheck=[true|false]    Perform type checking, so that values can be assigned to the corresponding definitions
                                (default \`true\`)
    --libCheck==[true|false]    Perform semantic checking on every source file. If \`false\`, only definitions required
                                by the main file will be checked (default \`false\`)
`

const path = process.argv.at(-1)!
if (!path || process.argv.includes('--help') || process.argv.includes('-h')) {
    console.info(usage)
    process.exit()
}
const sourcePath = resolve(path)
if (!existsSync(sourcePath)) {
    console.error(`no such file \`${path}\``)
    process.exit()
}
const source: Source = { code: readFileSync(sourcePath).toString(), filepath: sourcePath }

const moduleAst = buildModule(source, pathToVid(basename(sourcePath)))

if (!moduleAst) {
    process.exit(1)
}

const pkg: Package = {
    path: source.filepath,
    name: moduleAst.identifier.names.at(-1)!,
    modules: [moduleAst]
}

const std = buildPackage(join(dir, 'std'), 'std')
if (!std) {
    process.exit(1)
}

const packages = [std, pkg]
const config = fromCmdFlags(process.argv)
const ctx: Context = {
    config,
    moduleStack: [],
    packages,
    impls: [],
    errors: [],
    warnings: [],
    check: false
}

// AOT module preparation allows:
// 1. Module defs can be referenced before their initialization
// 2. Vids resolved from another module needn't to check the whole module, only that specific definition
ctx.packages.forEach(p => {
    p.modules.forEach(m => {
        prepareModule(m)
    })
})
// TODO: all impls should probably be checked, either when method is resolved, or just with checkTopLevelDefinition
ctx.impls = buildInstanceRelations(ctx)
ctx.check = true
if (ctx.config.libCheck) {
    ctx.packages.flatMap(p => p.modules).forEach(m => checkModule(m, ctx))
} else {
    checkModule(moduleAst, ctx)
}

if (ctx.errors.length > 0) {
    for (const error of ctx.errors) {
        console.error(
            prettySourceMessage(colorError(error.message), getLocationRange(error.node.parseNode), error.module.source)
        )
    }
    process.exit(1)
}

for (const warning of ctx.warnings) {
    console.error(
        prettySourceMessage(
            colorWarning(warning.message),
            getLocationRange(warning.node.parseNode),
            warning.module.source
        )
    )
}
