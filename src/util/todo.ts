export const todo = (message?: string): never => {
    throw Error('TODO' + (message ? `: ${message}` : ''))
}

export const assert = (condition: boolean, message?: string): void | never => {
    if (!condition) {
        throw Error('Assertion failed' + (message ? `: ${message}` : ''))
    }
}
