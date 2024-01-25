/**
 * @template T
 * @param {List<T>} list
 * @param {Int} index
 * @returns {Option<T>}
 */
function listAt(list, index) {
    if (index < 0 || index >= list.value.length) {
        return Option.None()
    }
    const e = list.value[index]
    return Option.Some(e)
}

/**
 * @template T
 * @param {List<T>} list
 * @param {T} item
 * @returns {Unit}
 */
function listAdd(list, item) {
    list.value.push(item)
}
