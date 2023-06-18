import { AstNodeKind } from '../ast'
import { VirtualIdentifier } from '../scope'

const stdOpScope = ['std', 'op']
export const operatorImplMap: Map<AstNodeKind, VirtualIdentifier> = new Map([
    ['neg-op', { scope: stdOpScope, name: 'Neg' }],
    ['not-op', { scope: stdOpScope, name: 'Not' }],

    ['add-op', { scope: stdOpScope, name: 'Add' }],
    ['sub-op', { scope: stdOpScope, name: 'Sub' }],
    ['mult-op', { scope: stdOpScope, name: 'Mult' }],
    ['div-op', { scope: stdOpScope, name: 'Div' }],
    ['exp-op', { scope: stdOpScope, name: 'Exp' }],
    ['mod-op', { scope: stdOpScope, name: 'Mod' }],
    ['eq-op', { scope: stdOpScope, name: 'Eq' }],
    ['ne-op', { scope: stdOpScope, name: 'Eq' }],
    ['ge-op', { scope: stdOpScope, name: 'Ord' }],
    ['le-op', { scope: stdOpScope, name: 'Ord' }],
    ['gt-op', { scope: stdOpScope, name: 'Ord' }],
    ['lt-op', { scope: stdOpScope, name: 'Ord' }],
    ['and-op', { scope: stdOpScope, name: 'And' }],
    ['or-op', { scope: stdOpScope, name: 'Or' }],
])
