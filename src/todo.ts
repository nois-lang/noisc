export const todo = (message?: string): any => {
    throw new Error('TODO' + (message ? `: ${message}` : ''))
}
