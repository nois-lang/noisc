const base64Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.split('')

export const encode = (n: number): string => {
    if (0 <= n && n < base64Alphabet.length) {
        return base64Alphabet[n]
    }
    throw Error(`out of bounds: ${n}`)
}
