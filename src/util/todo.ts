export const todo = (message?: string): any => {
    throw Error('TODO' + (message ? `: ${message}` : ''))
}
