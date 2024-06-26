import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'fs'
import { basename, join, parse, relative } from 'path'
import { writeFile } from 'fs/promises'
import { Package } from '.'
import { emitDeclaration } from '../codegen/declaration'
import { emitModule } from '../codegen/js'
import { info } from '../output'
import { Context } from '../scope'
import { findMain } from '../scope/util'
import { createSourceMap, foldEmitTree } from '../sourcemap'

export const emitPackage = async (isDir: boolean, pkg: Package, ctx: Context): Promise<void> => {
    if (isDir) {
        mkdirSync(ctx.config.outPath, { recursive: true })
        const packageInfoSrc = join(ctx.config.pkgPath, 'package.json')
        if (!existsSync(packageInfoSrc)) {
            console.error(`${packageInfoSrc} not found`)
            process.exit(1)
        }
        const packageInfoDest = join(ctx.config.outPath, 'package.json')
        copyFileSync(packageInfoSrc, packageInfoDest)
        info(ctx.config, `copy: ${packageInfoSrc} -> ${packageInfoDest}`)

        const ps = pkg.modules.flatMap(m => {
            ctx.variableCounter = 0
            ctx.moduleStack.push(m)
            const modulePath = relative(ctx.config.srcPath, m.source.filepath)
            const moduleOutPath = parse(join(ctx.config.outPath, modulePath))
            mkdirSync(moduleOutPath.dir, { recursive: true })
            const ps: Promise<void>[] = []

            const declaration = emitDeclaration(m)
            const declarationPath = join(moduleOutPath.dir, moduleOutPath.name) + '.no'
            ps.push(
                writeFile(declarationPath, declaration).then(() => {
                    info(ctx.config, `emit: declaration  ${declarationPath} [${declaration.length}B]`)
                })
            )

            const nativePath = m.source.filepath.replace(/\.no$/, '.js')
            const native = existsSync(nativePath)
                ? readFileSync(nativePath)
                      .toString()
                      .replace(/^[ \t]*(\/\/|\/\*|\*).*\s/gm, '')
                : ''
            const emitNode = emitModule(m, ctx, findMain(m) !== undefined)
            const { emit, map } = foldEmitTree(emitNode)

            const sourceMapLink = `//# sourceMappingURL=${moduleOutPath.name}.js.map`
            const js = [emit, native, sourceMapLink].filter(m => m.length > 0).join('\n')
            const jsPath = join(moduleOutPath.dir, moduleOutPath.name) + '.js'
            ps.push(writeFile(jsPath, js).then(() => info(ctx.config, `emit: js           ${jsPath} [${js.length}B]`)))

            const sourceMap = JSON.stringify(
                createSourceMap(
                    basename(jsPath),
                    relative(moduleOutPath.dir, m.source.filepath),
                    m.source.code,
                    js,
                    map
                )
            )
            const sourceMapPath = join(moduleOutPath.dir, moduleOutPath.name) + '.js.map'
            ps.push(
                writeFile(sourceMapPath, sourceMap).then(() =>
                    info(ctx.config, `emit: source map   ${sourceMapPath} [${sourceMap.length}B]`)
                )
            )
            return ps
        })
        await Promise.all(ps)
    } else {
        const m = pkg.modules[0]
        const emitNode = emitModule(m, ctx, findMain(m) !== undefined)
        const { emit } = foldEmitTree(emitNode)
        const jsPath = join(ctx.config.outPath, parse(ctx.config.pkgPath).name) + '.js'
        await writeFile(jsPath, emit).then(() => info(ctx.config, `emit: js           ${jsPath} [${emit.length}B]`))
    }
}
