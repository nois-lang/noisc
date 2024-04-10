/**
 * @param {number} value
 * @returns {Int}
 */
Int.Int = value => ({
    $noisType: 'std::int::Int',
    value,
    upcast: (value, self) => {
        Object.assign(value, self)
    }
})

/**
 * @param {Int} a
 * @returns {Int}
 */
export function negInt(a) {
    return Int.Int(-a.value)
}

/**
 * @param {Int} a
 * @returns {Int}
 */
export function absInt(a) {
    return Int.Int(Math.abs(a.value))
}

/**
 * @param {Int} a
 * @param {Int} b
 * @returns {Int}
 */
export function addInt(a, b) {
    return Int.Int(a.value + b.value)
}

/**
 * @param {Int} a
 * @param {Int} b
 * @returns {Int}
 */
export function subInt(a, b) {
    return Int.Int(a.value - b.value)
}

/**
 * @param {Int} a
 * @param {Int} b
 * @returns {Int}
 */
export function multInt(a, b) {
    return Int.Int(a.value * b.value)
}

/**
 * @param {Int} a
 * @param {Int} b
 * @returns {Int}
 */
export function divInt(a, b) {
    return Int.Int(a.value / b.value)
}

/**
 * @param {Int} a
 * @param {Int} b
 * @returns {Int}
 */
export function expInt(a, b) {
    return Int.Int(a.value ** b.value)
}

/**
 * @param {Int} a
 * @param {Int} b
 * @returns {Int}
 */
export function modInt(a, b) {
    return Int.Int(a.value % b.value)
}

/**
 * @param {Int} a
 * @param {Int} b
 * @returns {Bool}
 */
export function eqInt(a, b) {
    return Bool.Bool(a.value === b.value)
}

/**
 * @param {Int} a
 * @param {Int} b
 * @returns {Ordering}
 */
export function cmpInt(a, b) {
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
export function showInt(a) {
    return String.String(a.value.toString())
}
