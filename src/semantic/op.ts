import { AstNodeKind } from '../ast'
import { vidFromString } from '../scope/util'
import { VirtualIdentifier } from '../scope/vid'

export const operatorImplMap: Map<AstNodeKind, VirtualIdentifier> = new Map([
    ['add-op', vidFromString('std::num::Num::add')],
    ['sub-op', vidFromString('std::num::Num::sub')],
    ['mult-op', vidFromString('std::num::Num::mult')],
    ['div-op', vidFromString('std::num::Num::div')],
    ['exp-op', vidFromString('std::num::Num::exp')],
    ['eq-op', vidFromString('std::eq::Eq::eq')],
    ['ne-op', vidFromString('std::eq::Eq::ne')],
    ['ge-op', vidFromString('std::ord::Ord::ge')],
    ['le-op', vidFromString('std::ord::Ord::le')],
    ['gt-op', vidFromString('std::ord::Ord::gt')],
    ['lt-op', vidFromString('std::ord::Ord::lt')],
    ['and-op', vidFromString('std::bool::Bool::and')],
    ['or-op', vidFromString('std::bool::Bool::or')],
    ['mod-op', vidFromString('std::int::Int::mod')]
])
