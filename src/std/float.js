/**
 * @param {number} value
 * @returns {Float}
 */
Float.Float = function(value) {
    return { $noisType: 'std::float::Float', value }
}

/**
 * @param {Float} a
 * @returns {Float}
 */
function negFloat(a) {
    return Float.Float(-a.value)
}

/**
 * @param {Float} a
 * @returns {Float}
 */
function absFloat(a) {
    return Float.Float(Math.abs(a.value))
}

/**
 * @param {Float} a
 * @param {Float} b
 * @returns {Float}
 */
function addFloat(a, b) {
    return Float.Float(a.value + b.value)
}

/**
 * @param {Float} a
 * @param {Float} b
 * @returns {Float}
 */
function subFloat(a, b) {
    return Float.Float(a.value - b.value)
}

/**
 * @param {Float} a
 * @param {Float} b
 * @returns {Float}
 */
function multFloat(a, b) {
    return Float.Float(a.value * b.value)
}

/**
 * @param {Float} a
 * @param {Float} b
 * @returns {Float}
 */
function divFloat(a, b) {
    return Float.Float(a.value / b.value)
}

/**
 * @param {Float} a
 * @param {Float} b
 * @returns {Float}
 */
function expFloat(a, b) {
    return Float.Float(a.value ** b.value)
}

/**
 * @param {Float} a
 * @param {Float} b
 * @returns {Bool}
 */
function eqFloat(a, b) {
    return Bool.Bool(a.value === b.value)
}

/**
 * @param {Float} a
 * @returns {String}
 */
function fmtFloat(a) {
    return Float.Float(a.value.toString())
}
