/**
 * @template T
 * @param {T[]} value
 * @returns {List<T>}
 */
List.List = value => ({
    $noisType: 'std::list::List',
    value,
    upcast: (value, self, t) => {
        for (const [trait, impl] of self) {
            value[trait] = impl
        }
        if (t !== undefined) {
            for (const item of value.value) {
                for (const [itemTrait, itemImpl] of t) {
                    item[itemTrait] = itemImpl
                }
            }
        }
    }
})

/**
 * @template T
 * @param {List<T>} list
 * @param {Int} index
 * @returns {Option<T>}
 */
function listAt(list, index) {
    const i = index.value
    if (i < 0 || i >= list.value.length) {
        return Option.None()
    }
    const e = list.value[i]
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
