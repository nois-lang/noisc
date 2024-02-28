/**
 * @param {string} a
 * @returns {String}
 */
String.String = function(a) {
    return { $noisType: 'std::string::String', value: a }
}

/**
 * @param {String} a
 * @param {String} b
 * @returns {String}
 */
function concatString(a, b) {
    return String(a.value + b.value)
}

/**
 * @param {String} a
 * @param {String} b
 * @returns {Bool}
 */
function eqString(a, b) {
    return String(a.value === b.value)
}
