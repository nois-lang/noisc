export const assign = <T extends Record<string, any>>(a: T, b: Record<string, any>): T => {
    if (a === b) return a
    Object.keys(a).forEach(k => delete a[k])
    Object.assign(a, b)
    return a
}
