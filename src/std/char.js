/**
 * @param {string} value
 * @returns {Char}
 */
Char.Char = value => ({
    $noisType: 'std::char::Char',
    value,
    upcast: (value, self) => {
        Object.assign(value, self)
    }
})

/**
 * @param {Char} a
 * @returns {String}
 */
export function showChar(a) {
    return String.String(a.value)
}

/**
 * @param {Char} a
 * @param {Char} b
 * @returns {Bool}
 */
export function eqChar(a, b) {
    return Bool.Bool(a.value === b.value)
}
