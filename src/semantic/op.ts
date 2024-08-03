import { AstNodeKind } from '../ast'
import { Identifier } from '../ast/operand'
import { idFromString } from '../typecheck'

export const operatorImplMap: Map<AstNodeKind, Identifier> = new Map([
    ['add-op', idFromString('std::num::Num::add')],
    ['sub-op', idFromString('std::num::Num::sub')],
    ['mult-op', idFromString('std::num::Num::mult')],
    ['div-op', idFromString('std::num::Num::div')],
    ['exp-op', idFromString('std::num::Num::exp')],
    ['eq-op', idFromString('std::eq::Eq::eq')],
    ['ne-op', idFromString('std::eq::Eq::ne')],
    ['ge-op', idFromString('std::ord::Ord::ge')],
    ['le-op', idFromString('std::ord::Ord::le')],
    ['gt-op', idFromString('std::ord::Ord::gt')],
    ['lt-op', idFromString('std::ord::Ord::lt')],
    ['and-op', idFromString('std::bool::Bool::and')],
    ['or-op', idFromString('std::bool::Bool::or')],
    ['mod-op', idFromString('std::int::Int::mod')]
])
