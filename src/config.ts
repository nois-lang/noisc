import { parseOption } from './cli'

export interface Config {
    pkgName?: string
    pkgPath: string
    srcPath: string
    libPath: string
    outPath: string
    deps: string[]
    libCheck: boolean
}

export const makeConfig = (pkgName: string, pkgPath: string): Config => {
    const libPath = 'dist'
    return {
        pkgName,
        pkgPath,
        srcPath: 'src',
        libPath,
        outPath: `${libPath}/${pkgName}`,
        deps: [],
        libCheck: false
    }
}

export const fromCmd = (): Config => {
    const pkgName = parseOption('name')
    const libPath = parseOption('lib') ?? `dist`
    return {
        pkgName,
        pkgPath: process.argv.at(-1)!,
        srcPath: parseOption('src') ?? 'src',
        libPath,
        outPath: parseOption('out') ?? `${libPath}/${pkgName}`,
        deps: parseOption('deps')?.split(',') ?? [],
        libCheck: parseOption('libCheck') === 'true'
    }
}
