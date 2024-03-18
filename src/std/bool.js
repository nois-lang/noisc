/**
 * @param {boolean} value
 * @returns {Boolean}
 */
Bool.Bool = value => ({
    $noisType: 'std::bool::Bool',
    value,
    upcast: (value, self) => {
        for (const [trait, impl] of self) {
            value[trait] = impl
        }
    }
})

/**
 * @param {Bool} a
 * @param {Bool} b
 * @returns {Bool}
 */
function andBool(a, b) {
    return Bool.Bool(a.value && b.value)
}

/**
 * @param {Bool} a
 * @param {Bool} b
 * @returns {Bool}
 */
function orBool(a, b) {
    return Bool.Bool(a.value || b.value)
}

/**
 * @param {Bool} a
 * @returns {Bool}
 */
function notBool(a) {
    return Bool.Bool(!a.value)
}

/**
 * @param {Bool} a
 * @returns {String}
 */
function showBool(a) {
    return String.String(a.value.toString())
}

/**
 * @param {Bool} a
 * @param {Bool} b
 * @returns {Bool}
 */
function eqBool(a, b) {
    return Bool.Bool(a.value === b.value)
}
