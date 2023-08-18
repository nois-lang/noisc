export const merge = <K, V>(
    a: Map<K, V>,
    b: Map<K, V>,
    collisionFn: (prev: V, next: V) => V = (_, n) => n
): Map<K, V> => {
    const map = new Map<K, V>()
    a.forEach((v, k) => {
        map.set(k, v)
    })
    b.forEach((v, k) => {
        const old = map.get(k)
        map.set(k, old === undefined ? v : collisionFn(old, v))
    })
    return map
}
