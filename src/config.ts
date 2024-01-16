export interface Config {
    /**
     * Perform type checking, so that values can be assigned to the corresponding definitions
     */
    typeCheck: boolean
    /**
     * Perform semantic checking on every source file. If `false`, only definitions required by the main file will be
     * checked
     */
    libCheck: boolean
}

export const defaultConfig = (): Config => ({
    typeCheck: true,
    libCheck: false
})

export const fromCmdFlags = (args: string[]): Config => {
    let config = defaultConfig()
    const typeCheckCmd = args
        .find(a => a.startsWith('--typeCheck='))
        ?.split('=')
        .at(-1)
    if (typeCheckCmd) {
        config.typeCheck = typeCheckCmd === 'true'
    }
    const libCheckCmd = args
        .find(a => a.startsWith('--libCheck='))
        ?.split('=')
        .at(-1)
    if (libCheckCmd) {
        config.libCheck = libCheckCmd === 'true'
    }
    return config
}
