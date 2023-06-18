import { existsSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { prettyError, prettySourceMessage } from './error'
import { getAstLocationRange, } from './ast'
import { checkModule } from './semantic'
import { buildModule, buildStd, Context } from './scope'
import * as console from 'console'
import { indexToLocation } from './location'

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
const source = { str: readFileSync(sourcePath).toString(), filename: path }

const moduleAst = buildModule(source, { scope: [], name: 'test' })

const ctx: Context = { modules: [...buildStd(), moduleAst], scopeStack: [], errors: [] }
checkModule(moduleAst, ctx)

if (ctx.errors.length > 0) {
    for (const error of ctx.errors) {
        console.error(prettySourceMessage(
            prettyError(error.message),
            indexToLocation(getAstLocationRange(error.node).start, source)!,
            source
        ))
    }
    process.exit(1)
}
