import { parseOption } from './cli'

export interface Config {
    /**
     * Perform semantic checking on every source file. If `false`, only definitions required by the main file will be
     * checked
     */
    libCheck: boolean
}

export const defaultConfig = (): Config => ({
    libCheck: false
})

export const fromCmdFlags = (): Config => {
    const config = defaultConfig()
    config.libCheck = parseOption('libCheck') === 'true'
    return config
}
