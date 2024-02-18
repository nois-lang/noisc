export const parseOption = (longName: string): string | undefined => {
    const arg = process.argv.find(a => a.startsWith(`--${longName}`))
    if (arg?.includes('=')) {
        return arg.split('=')[1]
    }
    return arg !== undefined ? '' : undefined
}
