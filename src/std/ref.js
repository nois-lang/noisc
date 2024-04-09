/**
 * @template T
 * @param {T} a
 * @param {T} b
 * @returns {Bool}
 */
export function eqRef(a, b) {
    return Bool.Bool(a === b)
}
