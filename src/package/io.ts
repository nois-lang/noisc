import { readFileSync, readdirSync, statSync } from 'fs'
import { extname, join, relative } from 'path'
import { Module } from '../ast'
import { pathToVid } from '../scope'
import { Source } from '../source'
import { buildModule } from './build'
import { Package } from './index'

export const buildPackage = (path: string, name: string): Package | undefined => {
    const modules = getPackageModuleSources(path).map(s => buildModule(s, pathToVid(relative(path, s.filepath), name)))
    if (modules.some(m => !m)) {
        return undefined
    }
    return { path, name, modules: <Module[]>modules }
}

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
