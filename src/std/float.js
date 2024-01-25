/**
 * @param {Float} a
 * @returns {Float}
 */
function negFloat(a) {
    return -a.value
}

/**
 * @param {Float} a
 * @returns {Float}
 */
function absFloat(a) {
    return Math.abs(a.value)
}

/**
 * @param {Float} a
 * @param {Float} b
 * @returns {Float}
 */
function addFloat(a, b) {
    return a.value + b.value
}

/**
 * @param {Float} a
 * @param {Float} b
 * @returns {Float}
 */
function subFloat(a, b) {
    return a.value - b.value
}

/**
 * @param {Float} a
 * @param {Float} b
 * @returns {Float}
 */
function multFloat(a, b) {
    return a.value * b.value
}

/**
 * @param {Float} a
 * @param {Float} b
 * @returns {Float}
 */
function divFloat(a, b) {
    return a.value / b.value
}

/**
 * @param {Float} a
 * @param {Float} b
 * @returns {Float}
 */
function expFloat(a, b) {
    return a.value ** b.value
}

/**
 * @param {Float} a
 * @returns {String}
 */
function fmtFloat(a) {
    return a.value.toString()
}
