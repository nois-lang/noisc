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
}

export const makeConfig = (pkgName: string, pkgPath: string): Config => {
    const libPath = 'dist'
    return {
        pkgName,
        pkgPath,
        srcPath: `${pkgPath}/src`,
        libPath,
        outPath: `${libPath}/${pkgName}`,
        deps: [],
        libCheck: false,
        emit: true
    }
}

export const fromCmd = (): Config => {
    const pkgPath = process.argv.at(-1)!
    const pkgName = parseOption('name')
    const libPath = parseOption('lib') ?? `${pkgPath}/dist`
    const emitOption = parseOption('emit')
    return {
        pkgName,
        pkgPath,
        srcPath: parseOption('src') ?? `${pkgPath}/src`,
        libPath,
        outPath: parseOption('out') ?? `${libPath}/${pkgName ?? ''}`,
        deps: parseOption('deps')?.split(',') ?? [],
        libCheck: parseOption('libCheck') === 'true',
        emit: emitOption === 'true' || emitOption === undefined
    }
}
