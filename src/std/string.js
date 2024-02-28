/**
 * @param {string} value
 * @returns {String}
 */
String.String = function(value) {
    return { $noisType: 'std::string::String', value }
}

/**
 * @param {String} a
 * @param {String} b
 * @returns {String}
 */
function concatString(a, b) {
    return String.String(a.value + b.value)
}

/**
 * @param {String} a
 * @param {String} b
 * @returns {Bool}
 */
function eqString(a, b) {
    return String.String(a.value === b.value)
}
