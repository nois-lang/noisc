/**
 * @param {string} value
 * @returns {Char}
 */
Char.Char = function(value) {
    return { $noisType: 'std::char::Char', value }
}

/**
 * @param {Char} a
 * @returns {String}
 */
function fmtChar(a) {
    return String.String(a.value)
}

/**
 * @param {Char} a
 * @param {Char} b
 * @returns {Bool}
 */
function eqChar(a, b) {
    return Bool.Bool(a.value === b.value)
}
