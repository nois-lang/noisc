import { AstNodeKind } from '../ast'
import { vidFromString } from '../scope/util'
import { VirtualIdentifier } from '../scope/vid'

export const operatorImplMap: Map<AstNodeKind, VirtualIdentifier> = new Map([
    ['neg-op', vidFromString('std::op::Neg::Neg')],
    ['not-op', vidFromString('std::op::Not::Not')],

    ['add-op', vidFromString('std::op::Add::add')],
    ['sub-op', vidFromString('std::op::Sub::sub')],
    ['mult-op', vidFromString('std::op::Mult::mult')],
    ['div-op', vidFromString('std::op::Div::div')],
    ['exp-op', vidFromString('std::op::Exp::exp')],
    ['mod-op', vidFromString('std::op::Mod::mod')],
    ['eq-op', vidFromString('std::op::Eq::eq')],
    ['ne-op', vidFromString('std::op::Eq::ne')],
    ['ge-op', vidFromString('std::op::Ord::ge')],
    ['le-op', vidFromString('std::op::Ord::le')],
    ['gt-op', vidFromString('std::op::Ord::gt')],
    ['lt-op', vidFromString('std::op::Ord::lt')],
    ['and-op', vidFromString('std::op::And::and')],
    ['or-op', vidFromString('std::op::Or::or')],
])
