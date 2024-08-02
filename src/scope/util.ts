import { Module } from '../ast'
import { Statement } from '../ast/statement'

export const findMain = (module: Module): Statement | undefined => {
    if (module.mod && module.identifier.names.length === 1) {
        return module.block.statements.find(s => s.kind === 'fn-def' && s.pub && s.name.value === 'main')
    }
    return undefined
}
