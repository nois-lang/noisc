export let colorOutput = true

const format = {
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m'
}
export const red = (str: string): string => colorOutput ? format.red + str + format.reset : str

export const yellow = (str: string): string => colorOutput ? format.yellow + str + format.reset : str
