import { AstNodeKind } from '../ast'
import { Identifier } from '../ast/operand'
import { idFromString } from '../scope'

export const operatorImplMap: Map<AstNodeKind, Identifier> = new Map([
    ['add-op', idFromString('Num::add')],
    ['sub-op', idFromString('Num::sub')],
    ['mult-op', idFromString('Num::mult')],
    ['div-op', idFromString('Num::div')],
    ['exp-op', idFromString('Num::exp')],
    ['eq-op', idFromString('Eq::eq')],
    ['ne-op', idFromString('Eq::ne')],
    ['ge-op', idFromString('Ord::ge')],
    ['le-op', idFromString('Ord::le')],
    ['gt-op', idFromString('Ord::gt')],
    ['lt-op', idFromString('Ord::lt')],

    ['mod-op', idFromString('int::mod')],
    ['and-op', idFromString('bool::and')],
    ['or-op', idFromString('bool::or')]
])
