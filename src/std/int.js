/**
 * @param {Int} a
 * @returns {Int}
 */
function negInt(a) {
    return -a.value
}

/**
 * @param {Int} a
 * @returns {Int}
 */
function absInt(a) {
    return Math.abs(a.value)
}

/**
 * @param {Int} a
 * @param {Int} b
 * @returns {Int}
 */
function addInt(a, b) {
    return a.value + b.value
}

/**
 * @param {Int} a
 * @param {Int} b
 * @returns {Int}
 */
function subInt(a, b) {
    return a.value - b.value
}

/**
 * @param {Int} a
 * @param {Int} b
 * @returns {Int}
 */
function multInt(a, b) {
    return a.value * b.value
}

/**
 * @param {Int} a
 * @param {Int} b
 * @returns {Int}
 */
function divInt(a, b) {
    return a.value / b.value
}

/**
 * @param {Int} a
 * @param {Int} b
 * @returns {Int}
 */
function expInt(a, b) {
    return a.value ** b.value
}

/**
 * @param {Int} a
 * @returns {String}
 */
function fmtInt(a) {
    return a.value.toString()
}
