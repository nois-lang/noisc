import { AstNode } from '../ast'
import { Identifier } from '../ast/operand'
import { Context } from '../scope'

export const setSelfBound = (node: AstNode, ctx: Context) => {
    switch (node.kind) {
        case 'module': {
            node.block.statements.forEach(s => setSelfBound(s, ctx))
            break
        }
        case 'trait-def': {
            const selfParam = node.typeParams.find(g => g.name.value === 'Self')
            // TODO: type args
            const id: Identifier = {
                kind: 'identifier',
                parseNode: node.name.parseNode,
                names: [node.name],
                typeArgs: [],
                def: node
            }
            selfParam?.bounds.push(id)
            break
        }
        case 'impl-def': {
            const selfParam = node.typeParams.find(g => g.name.value === 'Self')
            selfParam?.bounds.push(node.for ? node.for : node.trait)
            break
        }
    }
}
