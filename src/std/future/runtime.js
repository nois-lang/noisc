/**
 * @param {||: Unit} f
 * @param {Int} delay
 * @returns {Unit}
 */
export function deferFor(f, delay) {
    setTimeout(f, delay.value)
}
