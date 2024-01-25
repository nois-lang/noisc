/**
 * @param {number} a
 * @returns {Int}
 */
function Int(a) {
    return { $noisType: 'std::int::Int', value: a }
}

/**
 * @param {Int} a
 * @returns {Int}
 */
function negInt(a) {
    return Int(-a.value)
}

/**
 * @param {Int} a
 * @returns {Int}
 */
function absInt(a) {
    return Int(Math.abs(a.value))
}

/**
 * @param {Int} a
 * @param {Int} b
 * @returns {Int}
 */
function addInt(a, b) {
    return Int(a.value + b.value)
}

/**
 * @param {Int} a
 * @param {Int} b
 * @returns {Int}
 */
function subInt(a, b) {
    return Int(a.value - b.value)
}

/**
 * @param {Int} a
 * @param {Int} b
 * @returns {Int}
 */
function multInt(a, b) {
    return Int(a.value * b.value)
}

/**
 * @param {Int} a
 * @param {Int} b
 * @returns {Int}
 */
function divInt(a, b) {
    return Int(a.value / b.value)
}

/**
 * @param {Int} a
 * @param {Int} b
 * @returns {Int}
 */
function expInt(a, b) {
    return Int(a.value ** b.value)
}

/**
 * @param {Int} a
 * @returns {String}
 */
function fmtInt(a) {
    return Int(a.value.toString())
}
