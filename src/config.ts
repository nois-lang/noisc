export interface Config {
    typecheck: boolean
}

export const defaultConfig = (): Config => ({
    typecheck: true
})
