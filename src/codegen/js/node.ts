import { jsString } from '.'
import { ParseNode } from '../../parser'

export type EmitNode = EmitToken | EmitTree

export interface EmitToken {
    kind: 'token'
    value: string
    parseNode?: ParseNode
}

export const emitToken = (value: string, parseNode?: ParseNode): EmitToken => {
    return {
        kind: 'token',
        parseNode,
        value
    }
}

export interface EmitTree {
    kind: 'node'
    nodes: EmitNode[]
    parseNode?: ParseNode
}

export const emitTree = (nodes: (EmitNode | undefined)[], parseNode?: ParseNode): EmitTree => {
    return {
        kind: 'node',
        nodes: nodes.filter(n => n).map(n => n!),
        parseNode
    }
}

export const emitAppendStr = (node: EmitNode, str: string): EmitNode => {
    if (node.kind === 'node') {
        node.nodes.push(emitToken(str))
    } else {
        node.value += str
    }
    return node
}

export const jsVariable = (name: string, emit?: EmitNode, pub = false): EmitNode => {
    const pubStr = pub ? 'export ' : ''
    if (emit) {
        return emitTree([emitToken(`${pubStr}let ${name} = `), emit, emitToken(';')])
    } else {
        return emitToken(`${pubStr}let ${name};`)
    }
}

export const jsError = (message?: string): EmitToken => {
    const msg = `codegen error: ${message ?? ''}`
    return emitToken(`(() => { throw Error(${jsString(msg)}); })()`)
}

export const emitIntersperse = (
    lines: (EmitNode | undefined)[],
    separator: string,
    parseNode?: ParseNode
): EmitTree => {
    return emitTree(
        lines
            .filter(l => !!l)
            .map(l => l!)
            .filter(l => l.kind === 'node' || l.value.length > 0)
            .map((l, i, ls) => {
                if (i !== ls.length - 1) {
                    return emitAppendStr(l, separator)
                }
                return l
            }),
        parseNode
    )
}
