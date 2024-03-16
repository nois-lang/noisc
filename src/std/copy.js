/**
 * @template T
 * @param {T} a
 * @returns {T}
 */
export function copy(a) {
    const copy = {}
    Object.assign(copy, a)
    return copy
}
