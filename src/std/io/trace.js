/**
 * @template T
 * @param {T} a
 * @returns {String}
 */
function trace(a) {
    return String.String(trace_(a))
}

/**
 * @template T
 * @param {T} a
 * @returns {string}
 * TODO: call overloaded trace() instead of calling the default one for nested values
 */
function trace_(a) {
    if (typeof a.value !== 'object') {
        if (typeof a.value === 'string') {
            return JSON.stringify(a.value)
        }
        return a.value.toString()
    }
    if (a.$noisType === 'std::list::List') {
        return `[${a.value.map(trace_).join(', ')}]`
    }

    const variant = a.$noisVariant ?? a.$noisType.slice(a.$noisType.lastIndexOf('::') + 2)
    return `${variant}(${[...Object.entries(a.value)]
        .map(([name, value]) => `${name}: ${trace_(value)}`)
        .join(', ')})`
}
