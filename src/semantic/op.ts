import { AstNodeKind } from '../ast'
import { VirtualIdentifier } from '../scope'

export const operatorImplMap: Map<AstNodeKind, VirtualIdentifier> = new Map([
    ['neg-op', { scope: ['std', 'op', 'Neg'], name: 'Neg' }],
    ['not-op', { scope: ['std', 'op', 'Not'], name: 'Not' }],

    ['add-op', { scope: ['std', 'op', 'Add'], name: 'add' }],
    ['sub-op', { scope: ['std', 'op', 'Sub'], name: 'sub' }],
    ['mult-op', { scope: ['std', 'op', 'Mult'], name: 'mult' }],
    ['div-op', { scope: ['std', 'op', 'Div'], name: 'div' }],
    ['exp-op', { scope: ['std', 'op', 'Exp'], name: 'exp' }],
    ['mod-op', { scope: ['std', 'op', 'Mod'], name: 'mod' }],
    ['eq-op', { scope: ['std', 'op', 'Eq'], name: 'eq' }],
    ['ne-op', { scope: ['std', 'op', 'Eq'], name: 'ne' }],
    ['ge-op', { scope: ['std', 'op', 'Ord'], name: 'ge' }],
    ['le-op', { scope: ['std', 'op', 'Ord'], name: 'le' }],
    ['gt-op', { scope: ['std', 'op', 'Ord'], name: 'gt' }],
    ['lt-op', { scope: ['std', 'op', 'Ord'], name: 'lt' }],
    ['and-op', { scope: ['std', 'op', 'And'], name: 'and' }],
    ['or-op', { scope: ['std', 'op', 'Or'], name: 'or' }],
])
