import { readdirSync, statSync, writeFileSync } from 'fs'
import { dirname, extname, join, relative } from 'path'
import { fileURLToPath } from 'url'

const getPackageModuleVids = (packagePath: string, packageName?: string): string[][] => {
    return listFiles(packagePath)
        .filter(f => extname(f).toLowerCase() === '.no')
        .map(p => relative(packagePath, p))
        .map(p => pathToVid(p, packageName))
}

const listFiles = (dir: string): string[] => {
    return readdirSync(dir).flatMap(f => {
        const fPath = join(dir, f)
        return statSync(fPath).isDirectory() ? listFiles(fPath) : [fPath]
    })
}

export const pathToVid = (path: string, packageName?: string): string[] => {
    const dirs = path.replace(/\.no$/, '').split('/')
    if (packageName) {
        dirs.unshift(packageName)
    }
    if (dirs.at(-1)!.toLowerCase() === 'mod') {
        dirs.pop()
    }
    return dirs
}

const stdPath = join(dirname(fileURLToPath(import.meta.url)), 'src', 'std')
const vids = getPackageModuleVids(stdPath, 'std')
const f = `export const stdModuleVids = ${JSON.stringify(vids)}`
writeFileSync('dist/std-index.js', f)
