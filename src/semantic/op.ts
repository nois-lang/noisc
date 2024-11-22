import { AstNodeKind } from '../ast'
import { Identifier } from '../ast/operand'
import { idFromString } from '../scope'

export const opFnIdMap: Map<AstNodeKind, Identifier> = new Map([
    ['add-op', idFromString('add')],
    ['sub-op', idFromString('sub')],
    ['mult-op', idFromString('mult')],
    ['div-op', idFromString('div')],
    ['exp-op', idFromString('exp')],
    ['eq-op', idFromString('eq')],
    ['ne-op', idFromString('ne')],
    ['ge-op', idFromString('ge')],
    ['le-op', idFromString('le')],
    ['gt-op', idFromString('gt')],
    ['lt-op', idFromString('lt')],

    ['mod-op', idFromString('mod')],
    ['and-op', idFromString('and')],
    ['or-op', idFromString('or')]
])
