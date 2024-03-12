/**
 * @param {number} value
 * @returns {Int}
 */
Int.Int = function(value) {
    return {
        $noisType: 'std::int::Int',
        value,
        upcast: function(value, Self) {
            for (const [trait, impl] of Self) {
                value[trait] = impl;
            }
        }
    }
}

/**
 * @param {Int} a
 * @returns {Int}
 */
function negInt(a) {
    return Int.Int(-a.value)
}

/**
 * @param {Int} a
 * @returns {Int}
 */
function absInt(a) {
    return Int.Int(Math.abs(a.value))
}

/**
 * @param {Int} a
 * @param {Int} b
 * @returns {Int}
 */
function addInt(a, b) {
    return Int.Int(a.value + b.value)
}

/**
 * @param {Int} a
 * @param {Int} b
 * @returns {Int}
 */
function subInt(a, b) {
    return Int.Int(a.value - b.value)
}

/**
 * @param {Int} a
 * @param {Int} b
 * @returns {Int}
 */
function multInt(a, b) {
    return Int.Int(a.value * b.value)
}

/**
 * @param {Int} a
 * @param {Int} b
 * @returns {Int}
 */
function divInt(a, b) {
    return Int.Int(a.value / b.value)
}

/**
 * @param {Int} a
 * @param {Int} b
 * @returns {Int}
 */
function expInt(a, b) {
    return Int.Int(a.value ** b.value)
}

/**
 * @param {Int} a
 * @param {Int} b
 * @returns {Bool}
 */
function eqInt(a, b) {
    return Bool.Bool(a.value === b.value)
}

/**
 * @param {Int} a
 * @returns {String}
 */
function fmtInt(a) {
    return String.String(a.value.toString())
}
