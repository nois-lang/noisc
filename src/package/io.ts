import { readdirSync, readFileSync, statSync } from 'fs'
import { extname, join } from 'path'
import { Source } from '../source'

export const getPackageModuleSources = (packagePath: string): Source[] => {
    const modulePaths = listFiles(packagePath).filter(f => extname(f).toLowerCase() === '.no')
    return modulePaths.map(path => {
        return { code: readFileSync(path).toString(), filepath: path }
    })
}

const listFiles = (dir: string): string[] => {
    return readdirSync(dir).flatMap(f => {
        const fPath = join(dir, f)
        return statSync(fPath).isDirectory() ? listFiles(fPath) : [fPath]
    })
}

