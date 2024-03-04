/**
 * @param {String} message
 * @returns {Never}
 */
function throwError(message) {
    Error.prepareStackTrace = (e, s) => {
        e.stack = undefined
        return s
    }
    const e = Error(message.value)
    throw e
}
