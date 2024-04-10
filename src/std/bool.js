/**
 * @param {boolean} value
 * @returns {Boolean}
 */
Bool.Bool = value => ({
    $noisType: 'std::bool::Bool',
    value,
    upcast: (value, self) => {
        Object.assign(value, self)
    }
})

/**
 * @param {Bool} a
 * @param {Bool} b
 * @returns {Bool}
 */
export function andBool(a, b) {
    return Bool.Bool(a.value && b.value)
}

/**
 * @param {Bool} a
 * @param {Bool} b
 * @returns {Bool}
 */
export function orBool(a, b) {
    return Bool.Bool(a.value || b.value)
}

/**
 * @param {Bool} a
 * @returns {Bool}
 */
export function notBool(a) {
    return Bool.Bool(!a.value)
}

/**
 * @param {Bool} a
 * @returns {String}
 */
export function showBool(a) {
    return String.String(a.value.toString())
}

/**
 * @param {Bool} a
 * @param {Bool} b
 * @returns {Bool}
 */
export function eqBool(a, b) {
    return Bool.Bool(a.value === b.value)
}
