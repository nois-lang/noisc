/**
 * @param {String} message
 * @returns {Never}
 */
export function throwError(message) {
    throw Error(message.value)
}
