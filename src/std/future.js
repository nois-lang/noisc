/**
 * @param {function(): Unit} f
 * @param {Int} delay
 * @returns {Unit}
 */
function deferFor(f, delay) {
    setTimeout(f, delay)
}
