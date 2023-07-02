import { prettyError, prettySourceMessage } from './error'
import { getAstLocationRange, Module, } from './ast'
import { checkModule, SemanticError } from './semantic'
import * as console from 'console'
import { indexToLocation } from './location'

async function main() {
    const { existsSync, readFileSync } = await import('fs')
    const { join, resolve } = await import('path')
    const { buildModule, pathToVid } = await import( './scope')
    const { getPackageModuleSources } = await import('./scope/io')

    const version = JSON.parse(readFileSync(join(__dirname, '..', 'package.json')).toString()).version

    const usage = `\
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

    if (!moduleAst) {
        process.exit(1)
    }

    const stdModules = getPackageModuleSources(join(__dirname, 'std')).map(s => buildModule(s, pathToVid(s.filename)))
    if (stdModules.some(m => !m)) {
        process.exit(1)
    }

    const ctx = { modules: [...<Module[]>stdModules, moduleAst], scopeStack: [], errors: [] }
    checkModule(moduleAst, ctx)

    if (ctx.errors.length > 0) {
        for (const error of <SemanticError[]>ctx.errors) {
            console.error(prettySourceMessage(
                prettyError(error.message),
                indexToLocation(getAstLocationRange(error.node).start, source)!,
                source
            ))
        }
        process.exit(1)
    }
}

if (process) {
    main().then()
}
