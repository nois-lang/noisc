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
