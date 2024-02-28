/**
 * @param {number} a
 * @returns {Float}
 */
Float.Float = function(a) {
    return { $noisType: 'std::float::Float', value: a }
}

/**
 * @param {Float} a
 * @returns {Float}
 */
function negFloat(a) {
    return Float(-a.value)
}

/**
 * @param {Float} a
 * @returns {Float}
 */
function absFloat(a) {
    return Float(Math.abs(a.value))
}

/**
 * @param {Float} a
 * @param {Float} b
 * @returns {Float}
 */
function addFloat(a, b) {
    return Float(a.value + b.value)
}

/**
 * @param {Float} a
 * @param {Float} b
 * @returns {Float}
 */
function subFloat(a, b) {
    return Float(a.value - b.value)
}

/**
 * @param {Float} a
 * @param {Float} b
 * @returns {Float}
 */
function multFloat(a, b) {
    return Float(a.value * b.value)
}

/**
 * @param {Float} a
 * @param {Float} b
 * @returns {Float}
 */
function divFloat(a, b) {
    return Float(a.value / b.value)
}

/**
 * @param {Float} a
 * @param {Float} b
 * @returns {Float}
 */
function expFloat(a, b) {
    return Float(a.value ** b.value)
}

/**
 * @param {Float} a
 * @param {Float} b
 * @returns {Bool}
 */
function eqFloat(a, b) {
    return Bool(a.value === b.value)
}

/**
 * @param {Float} a
 * @returns {String}
 */
function fmtFloat(a) {
    return Float(a.value.toString())
}
