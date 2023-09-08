export const todo = (message?: string): any => {
    throw Error('TODO' + (message ? `: ${message}` : ''))
}

export const assert = (condition: boolean, message?: string): any => {
    if (!condition) {
        throw Error('Assertion failed' + (message ? `: ${message}` : ''))
    }
}
