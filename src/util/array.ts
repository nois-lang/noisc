export const range = (from: number, to: number): number[] => new Array(to - from).fill(0).map((_, i) => i + from)

/**
 * Check wether every element in the array is equal using provided comparator function
 * Will only check first element against every other, relying on cmp associativity (if cmp(a, b) === cmp(b, c), then
 * cmp(a, c) === true)
 */
export const allEqual = <T>(arr: T[], cmp: (a: T, b: T) => boolean = (a, b) => a === b): boolean => {
    if (arr.length === 0) return true
    const first = arr[0]
    for (let i = 1; i < arr.length; i++) {
        if (!cmp(first, arr[i])) {
            return false
        }
    }
    return true
}
