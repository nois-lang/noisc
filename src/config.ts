export interface Config {
    checkUnusedModules: boolean
}

export const defaultConfig = (): Config => ({
    checkUnusedModules: true
})
