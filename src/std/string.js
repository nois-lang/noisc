/**
 * @param {string} value
 * @returns {String}
 */
String.String = value => ({
    $noisType: 'std::string::String',
    value,
    upcast: (value, self) => {
        Object.assign(value, self)
    }
})

/**
 * @param {String} a
 * @param {String} b
 * @returns {String}
 */
export function concatString(a, b) {
    return String.String(a.value + b.value)
}

/**
 * @param {String} a
 * @param {String} b
 * @returns {Bool}
 */
export function eqString(a, b) {
    return String.String(a.value === b.value)
}
