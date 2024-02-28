/**
 * @param {boolean} value
 * @returns {Boolean}
 */
Bool.Bool = function(value) {
    return { $noisType: 'std::bool::Bool', value }
}

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
function fmtBool(a) {
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
