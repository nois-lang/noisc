import { existsSync, readFileSync } from 'fs'
import { basename, join, resolve } from 'path'
import * as process from 'process'
import { defaultConfig } from './config'
import { prettyError, prettySourceMessage, prettyWarning } from './error'
import { indexToLocation } from './location'
import { Package } from './package'
import { buildModule, buildPackage } from './package/build'
import { getLocationRange } from './parser'
import { Context, pathToVid } from './scope'
import { findImpls } from './scope/trait'
import { checkModule, prepareModule } from './semantic'
import { Source } from './source'

const version = JSON.parse(readFileSync(join(__dirname, '..', 'package.json')).toString()).version

export const usage = `\
Nois transpiler - v${version}

Usage: nois file`

const path = process.argv.slice(2).at(0)
if (!path) {
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
    name: moduleAst?.identifier.names.at(-1)!,
    modules: [moduleAst]
}

const std = buildPackage(join(__dirname, 'std'), 'std')
if (!std) {
    process.exit(1)
}

const packages = [std, pkg]
const ctx: Context = {
    config: defaultConfig(),
    moduleStack: [],
    packages,
    errors: [],
    warnings: []
}

// AOT top scope init solves:
// 1. Module defs can be referenced before their initialization
// 2. Vids resolved from another module needn't to check the whole module, only that specific definition
ctx.packages.forEach(p => {
    p.modules.forEach(m => {
        prepareModule(m)
    })
})
if (ctx.config.libCheck) {
    ctx.packages.flatMap(p => p.modules).forEach(m => { checkModule(m, ctx) })
} else {
    checkModule(moduleAst, ctx)
}

if (ctx.errors.length > 0) {
    for (const error of ctx.errors) {
        console.error(prettySourceMessage(
            prettyError(error.message),
            indexToLocation(getLocationRange(error.node.parseNode).start, error.module.source)!,
            error.module.source
        ))
    }
    process.exit(1)
}

for (const warning of ctx.warnings) {
    console.error(prettySourceMessage(
        prettyWarning(warning.message),
        indexToLocation(getLocationRange(warning.node.parseNode).start, warning.module.source)!,
        warning.module.source
    ))
}
