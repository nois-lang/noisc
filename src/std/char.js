/**
 * @param {string} a
 * @returns {Char}
 */
Char.Char = function(a) {
    return { $noisType: 'std::char::Char', value: a }
}

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
