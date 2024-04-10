/**
 * @param {number} value
 * @returns {Float}
 */
Float.Float = value => ({
    $noisType: 'std::float::Float',
    value,
    upcast: (value, self) => {
        Object.assign(value, self)
    }
})

/**
 * @param {Float} a
 * @returns {Float}
 */
export function negFloat(a) {
    return Float.Float(-a.value)
}

/**
 * @param {Float} a
 * @returns {Float}
 */
export function absFloat(a) {
    return Float.Float(Math.abs(a.value))
}

/**
 * @param {Float} a
 * @param {Float} b
 * @returns {Float}
 */
export function addFloat(a, b) {
    return Float.Float(a.value + b.value)
}

/**
 * @param {Float} a
 * @param {Float} b
 * @returns {Float}
 */
export function subFloat(a, b) {
    return Float.Float(a.value - b.value)
}

/**
 * @param {Float} a
 * @param {Float} b
 * @returns {Float}
 */
export function multFloat(a, b) {
    return Float.Float(a.value * b.value)
}

/**
 * @param {Float} a
 * @param {Float} b
 * @returns {Float}
 */
export function divFloat(a, b) {
    return Float.Float(a.value / b.value)
}

/**
 * @param {Float} a
 * @param {Float} b
 * @returns {Float}
 */
export function expFloat(a, b) {
    return Float.Float(a.value ** b.value)
}

/**
 * @param {Float} a
 * @param {Float} b
 * @returns {Bool}
 */
export function eqFloat(a, b) {
    return Bool.Bool(a.value === b.value)
}

/**
 * @param {Float} a
 * @returns {String}
 */
export function showFloat(a) {
    return String.String(a.value.toString())
}
