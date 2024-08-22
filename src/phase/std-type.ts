import { AstNode } from '../ast'
import { Identifier } from '../ast/operand'
import { findName } from '../phase/name-resolve'
import { Context, addError, idFromString } from '../scope'
import { notFoundError } from '../semantic/error'
import { makeDefType } from '../typecheck'

export type StdTypeIds = {
    unit?: Identifier
    bool?: Identifier
    string?: Identifier
    char?: Identifier
    int?: Identifier
    float?: Identifier
    list?: Identifier
    show?: Identifier
    trace?: Identifier
    iter?: Identifier
    iterable?: Identifier
    unwrap?: Identifier
    future?: Identifier
}

export const preludeId = idFromString('std::prelude')

/**
 * Set `ctx.stdTypeIds` by resolving compiler-required types in std
 */
export const setStdTypeIds = (node: AstNode, ctx: Context): void => {
    ctx.stdTypeIds = {}
    const pairs = <const>[
        ['unit', 'Unit'],
        ['bool', 'Bool'],
        ['string', 'String'],
        ['char', 'Char'],
        ['int', 'Int'],
        ['float', 'Float'],
        ['list', 'List'],

        ['show', 'Show'],
        ['trace', 'Trace'],

        ['iter', 'Iter'],
        ['iterable', 'Iterable'],
        ['unwrap', 'Unwrap'],
        ['future', 'Future']
    ]
    pairs.forEach(([name, typeName]) => {
        const id = idFromString(typeName)
        const def = findName(typeName, ctx)
        if (!def) {
            addError(ctx, notFoundError(ctx, id, typeName, undefined, ['must be exported by `std` package']))
            return
        }
        id.def = def
        id.type = makeDefType(def)
        ctx.stdTypeIds[name] = id
    })
}
