import { AstNodeKind } from '../ast'
import { Identifier } from '../ast/operand'
import { idFromString } from '../scope'

export const operatorImplMap: Map<AstNodeKind, Identifier> = new Map([
    ['add-op', idFromString('Int::add')],
    ['sub-op', idFromString('Int::sub')],
    ['mult-op', idFromString('Int::mult')],
    ['div-op', idFromString('Int::div')],
    ['exp-op', idFromString('Int::exp')],
    ['mod-op', idFromString('Int::mod')],
    ['eq-op', idFromString('Eq::eq')],
    ['ne-op', idFromString('Eq::ne')],
    ['ge-op', idFromString('Ord::ge')],
    ['le-op', idFromString('Ord::le')],
    ['gt-op', idFromString('Ord::gt')],
    ['lt-op', idFromString('Ord::lt')],
    ['and-op', idFromString('Bool::and')],
    ['or-op', idFromString('Bool::or')]
])
