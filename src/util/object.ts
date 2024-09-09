export const assign = <T extends Record<string, any>>(a: T, b: Record<string, any>): T => {
    Object.keys(a).forEach(k => delete a[k])
    Object.assign(a, b)
    return a
}
