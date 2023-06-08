const format = {
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m'
}
export const red = (str: string): string => format.red + str + format.reset

export const yellow = (str: string): string => format.yellow + str + format.reset
