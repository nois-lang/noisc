import { AstNodeKind } from '../ast'
import { Identifier } from '../ast/operand'
import { idFromString } from '../scope'

export const operatorImplMap: Map<AstNodeKind, Identifier> = new Map([
    ['add-op', idFromString('std::int::Int::add')],
    ['sub-op', idFromString('std::int::Int::sub')],
    ['mult-op', idFromString('std::int::Int::mult')],
    ['div-op', idFromString('std::int::Int::div')],
    ['exp-op', idFromString('std::int::Int::exp')],
    ['mod-op', idFromString('std::int::Int::mod')],
    ['eq-op', idFromString('std::eq::Eq::eq')],
    ['ne-op', idFromString('std::eq::Eq::ne')],
    ['ge-op', idFromString('std::ord::Ord::ge')],
    ['le-op', idFromString('std::ord::Ord::le')],
    ['gt-op', idFromString('std::ord::Ord::gt')],
    ['lt-op', idFromString('std::ord::Ord::lt')],
    ['and-op', idFromString('std::bool::Bool::and')],
    ['or-op', idFromString('std::bool::Bool::or')]
])
