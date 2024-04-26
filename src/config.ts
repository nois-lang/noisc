import { parseOption } from './cli'

export interface Config {
    pkgName?: string
    pkgPath: string
    srcPath: string
    libPath: string
    outPath: string
    deps: string[]
    libCheck: boolean
    emit: boolean
    output: OutConfig
}

export interface OutConfig {
    write: boolean
}

export const makeConfig = (pkgName: string, pkgPath: string): Config => {
    const libPath = `${pkgPath}/dist`
    return {
        pkgName,
        pkgPath,
        srcPath: `${pkgPath}/src`,
        libPath,
        outPath: `${libPath}/${pkgName}`,
        deps: [],
        libCheck: false,
        emit: true,
        output: {
            write: false
        }
    }
}

export const fromCmd = (): Config => {
    const pkgPath = process.argv.at(-1)!
    const pkgName = parseOption('name')!

    const config = makeConfig(pkgName, pkgPath)

    const srcOpt = parseOption('src')
    if (srcOpt !== undefined) {
        config.srcPath = srcOpt
    }

    const libOpt = parseOption('lib')
    if (libOpt !== undefined) {
        config.libPath = libOpt
    }

    const emitOpt = parseOption('emit')
    if (emitOpt !== undefined) {
        config.emit = emitOpt === 'true'
    }

    const depsOpt = parseOption('deps')
    if (depsOpt !== undefined) {
        config.deps = depsOpt.split(',')
    }

    const libCheckOpt = parseOption('libCheck')
    if (libCheckOpt !== undefined) {
        config.libCheck = libCheckOpt === 'true'
    }

    const outputWriteOpt = parseOption('output.write')
    if (outputWriteOpt !== undefined) {
        config.output.write = outputWriteOpt === 'true'
    }

    return config
}
