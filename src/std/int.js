/**
 * @param {number} value
 * @returns {Int}
 */
Int.Int = value => ({
    $noisType: 'std::int::Int',
    value,
    upcast: (value, self) => {
        for (const [trait, impl] of self) {
            value[trait] = impl
        }
    }
})

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
 * @param {Int} b
 * @returns {Ordering}
 */
function cmpInt(a, b) {
    if (a.value === b.value) {
        return Ordering.Equal()
    }
    if (a.value > b.value) {
        return Ordering.Greater()
    }
    return Ordering.Less()
}

/**
 * @param {Int} a
 * @returns {String}
 */
function fmtInt(a) {
    return String.String(a.value.toString())
}
