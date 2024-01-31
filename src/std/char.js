/**
 * @param {Char} a
 * @returns {String}
 */
function fmtChar(a) {
    return String(a.value)
}

/**
 * @param {Char} a
 * @param {Char} b
 * @returns {Bool}
 */
function eqChar(a, b) {
    return Bool(a.value === b.value)
}
