import { readdirSync, readFileSync, statSync } from 'fs'
import { extname, join, relative } from 'path'
import { Source } from '../source'

export const listFiles = (dir: string): string[] => {
    return readdirSync(dir).flatMap(f => {
        const fPath = join(dir, f)
        return statSync(fPath).isDirectory() ? listFiles(fPath) : [fPath]
    })
}

export const getPackageModuleSources = (packagePath: string): Source[] => {
    const modulePaths = listFiles(packagePath).filter(f => extname(f).toLowerCase() === '.no')
    return modulePaths.map(path => {
        return { str: readFileSync(path).toString(), filename: relative(packagePath, path) }
    })
}
