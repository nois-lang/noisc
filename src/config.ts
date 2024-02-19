import { parseOption } from './cli'

export interface Config {
    pkgName?: string
    pkgPath: string
    srcPath: string
    outPath: string
    deps: string[]
    libCheck: boolean
}

export const makeConfig = (pkgName: string, pkgPath: string): Config => {
    return {
        pkgName,
        pkgPath,
        srcPath: 'src',
        outPath: 'dist',
        deps: [],
        libCheck: false
    }
}

export const fromCmd = (): Config => {
    return {
        pkgName: parseOption('name'),
        pkgPath: process.argv.at(-1)!,
        srcPath: parseOption('src') ?? 'src',
        outPath: parseOption('out') ?? 'dist',
        deps: parseOption('deps')?.split(',') ?? [],
        libCheck: parseOption('libCheck') === 'true'
    }
}
