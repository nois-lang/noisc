import { existsSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { prettyError, prettySourceMessage, prettyWarning } from './error'
import { Module, } from './ast'
import { checkModule } from './semantic'
import { buildModule, Context, pathToVid } from './scope'
import * as console from 'console'
import { indexToLocation } from './location'
import * as process from 'process'
import { getPackageModuleSources } from './scope/io'
import { getLocationRange } from './parser'
import { vidFromString } from './scope/vid'
import { defaultConfig } from './config'
import { Source } from './source'

const version = JSON.parse(readFileSync(join(__dirname, '..', 'package.json')).toString()).version

export const usage = `\
Nois transpiler - v${version}

Usage: nois file`

const path = process.argv.slice(2).at(0)
if (!path) {
    console.log(usage)
    process.exit()
}
const sourcePath = resolve(path)
if (!existsSync(sourcePath)) {
    console.error(`no such file \`${path}\``)
    process.exit()
}
const source: Source = { code: readFileSync(sourcePath).toString(), filepath: sourcePath }

const moduleAst = buildModule(source, vidFromString('test'))

if (!moduleAst) {
    process.exit(1)
}

const stdModules = getPackageModuleSources(join(__dirname, 'std')).map(s => {
    const stdModule = buildModule(s, pathToVid(s.filepath, 'std'))
    if (!stdModule) {
        process.exit(1)
    }
    return stdModule
})

const config = defaultConfig()
const ctx: Context = { config, modules: [...<Module[]>stdModules, moduleAst], scopeStack: [], errors: [], warnings: [] }

checkModule(moduleAst, ctx)

if (config.checkUnusedModules) {
    ctx.modules.forEach(m => { checkModule(m, ctx) })
}

if (ctx.errors.length > 0) {
    for (const error of ctx.errors) {
        console.error(prettySourceMessage(
            prettyError(error.message),
            indexToLocation(getLocationRange(error.node.parseNode).start, source)!,
            source
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
