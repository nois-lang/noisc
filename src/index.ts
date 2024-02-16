import { existsSync, readFileSync } from 'fs'
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

const ctx: Context = {
    config: fromCmdFlags(process.argv),
    moduleStack: [],
    packages: [std, pkg],
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
    checkModule(moduleAst, ctx)
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
