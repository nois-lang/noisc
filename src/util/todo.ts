export const todo = (message?: string): never => {
    throw Error('todo' + (message ? `: ${message}` : ''))
}

export const assert = (condition: boolean, message?: string): void | never => {
    if (!condition) {
        throw Error('assertion failed' + (message ? `: ${message}` : ''))
    }
}

export const unreachable = (message?: string): never => {
    throw Error('unreachable' + (message ? `: ${message}` : ''))
}
