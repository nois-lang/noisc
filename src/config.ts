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

export const fromCmdFlags = (args: string[]): Config => {
    const config = defaultConfig()
    config.libCheck = parseCmdFlag('libCheck', args) === 'true'
    return config
}

export const parseCmdFlag = (name: string, args: string[]): string | undefined => {
    return args
        .find(a => a.startsWith(`${name}=`))
        ?.split('=')
        .at(-1)
}
