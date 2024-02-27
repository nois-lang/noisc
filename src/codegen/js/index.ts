import { Module, Param } from '../../ast'
import { BinaryExpr, Expr, OperandExpr, UnaryExpr } from '../../ast/expr'
import { Operand } from '../../ast/operand'
import { Block, BreakStmt, FnDef, ImplDef, ReturnStmt, Statement, TraitDef, VarDef } from '../../ast/statement'
import { TypeDef } from '../../ast/type-def'
import { Context } from '../../scope'
import { vidFromScope } from '../../scope/util'
import { VirtualIdentifier } from '../../scope/vid'
import { groupBy } from '../../util/array'
import { todo } from '../../util/todo'

export interface JsImport {
    def: string
    path: string
}

export const emitModule = (module: Module, ctx: Context): string => {
    const statements = module.block.statements
        .map(s => emitStatement(s, module, ctx))
        .filter(s => s.length > 0)
        .join('\n\n')
    return [emitImports(module, ctx), statements].filter(s => s.length > 0).join('\n\n')
}

export const emitImports = (module: Module, ctx: Context): string => {
    const imports_: JsImport[] = module.imports
        .filter(i => i.module !== module)
        .map(i => {
            let vid = i.vid
            // variant constructors are always accessible from type reference, e.g. `Option.Some`, so only `Option`
            // needs to be imported
            if (i.def.kind === 'variant') {
                vid = vidFromScope(vid)
            }
            return makeJsImport(vid, i.module, module, ctx)
        })
    const imports = [...groupBy(imports_, i => i.path).entries()]
        .map(([path, is]) => {
            const defs = [...new Set(is.map(i => i.def))].toSorted()
            return `import { ${defs.join(', ')} } from "${path}.js";`
        })
        .join('\n')
    return imports
}

const makeJsImport = (vid: VirtualIdentifier, importModule: Module, module: Module, ctx: Context): JsImport => {
    const importPkg = vid.names[0]
    const modulePkg = ctx.packages.find(p => p.modules.find(m => m === module))!.name
    const def = vid.names.at(-1)!
    if (importPkg === modulePkg) {
        const root = ['.', ...new Array(module.identifier.names.length - 2).fill('..')]
        return { def, path: [...root, ...vid.names.slice(1, -1), ...(importModule.mod ? ['mod'] : [])].join('/') }
    }
    return { def, path: [...vid.names.slice(0, -1), ...(importModule.mod ? ['mod'] : [])].join('/') }
}

export const emitStatement = (statement: Statement, module: Module, ctx: Context): string => {
    switch (statement.kind) {
        case 'var-def':
            return emitVarDef(statement, module, ctx)
        case 'fn-def':
            return emitFnDef(statement, module, ctx)
        case 'trait-def':
            return emitTraitDef(statement, module, ctx)
        case 'impl-def':
            return emitImplDef(statement, module, ctx)
        case 'type-def':
            return emitTypeDef(statement, module, ctx)
        case 'return-stmt':
            return emitReturnStmt(statement, module, ctx)
        case 'break-stmt':
            return emitBreakStmt(statement, module, ctx)
        case 'operand-expr':
        case 'unary-expr':
        case 'binary-expr':
            return emitExpr(statement, module, ctx)
    }
}

export const emitVarDef = (varDef: VarDef, module: Module, ctx: Context): string => {
    if (varDef.pattern.expr.kind !== 'name') {
        return todo('destructuring')
    }
    const name = varDef.pattern.expr.value
    const expr = emitExpr(varDef.expr, module, ctx)
    return `const ${name} = ${expr};`
}

export const emitFnDef = (fnDef: FnDef, module: Module, ctx: Context, asProperty = false): string => {
    if (!fnDef.block) return ''
    const name = fnDef.name.value
    const params = fnDef.params.map(p => emitParam(p, module, ctx)).join(', ')
    const block = emitBlock(fnDef.block, module, ctx)
    if (asProperty) {
        return `${name}: function(${params}) ${block}`
    } else {
        return `function ${name}(${params}) ${block}`
    }
}

export const emitTraitDef = (traitDef: TraitDef, module: Module, ctx: Context): string => {
    const name = traitDef.name.value
    const impls_ = traitDef
        .rels!.map(r => emitInstance(r.instanceDef, module, ctx))
        .filter(i => i.length > 0)
        .map(i => indent(i))
    const impls = impls_.length > 0 ? `\n${impls_.join(',\n')}\n` : ''
    return `const ${name} = [${impls}];`
}

export const emitImplDef = (implDef: ImplDef, module: Module, ctx: Context): string => {
    // TODO
    return ''
}

export const emitTypeDef = (typeDef: TypeDef, module: Module, ctx: Context): string => {
    const name = typeDef.name.value
    const impl = typeDef.rel ? emitInstance(typeDef.rel.instanceDef, module, ctx) : '{}'
    return `const ${name} = ${impl};`
}

export const emitReturnStmt = (returnStmt: ReturnStmt, module: Module, ctx: Context): string => {
    const expr = emitExpr(returnStmt.returnExpr, module, ctx)
    return `return ${expr};`
}

export const emitBreakStmt = (breakStmt: BreakStmt, module: Module, ctx: Context): string => {
    return 'break;'
}

export const emitExpr = (expr: Expr, module: Module, ctx: Context): string => {
    switch (expr.kind) {
        case 'operand-expr':
            return emitOperandExpr(expr, module, ctx)
        case 'unary-expr':
            return emitUnaryExpr(expr, module, ctx)
        case 'binary-expr':
            return emitBinaryExpr(expr, module, ctx)
    }
}

export const emitOperandExpr = (operandExpr: OperandExpr, module: Module, ctx: Context): string => {
    return emitOperand(operandExpr.operand, module, ctx)
}

export const emitUnaryExpr = (unaryExpr: UnaryExpr, module: Module, ctx: Context): string => {
    switch (unaryExpr.op.kind) {
        case 'call-op':
            const operand = emitOperand(unaryExpr.operand, module, ctx)
            const args = unaryExpr.op.args.map(a => emitExpr(a.expr, module, ctx)).join(', ')
            return `${operand}(${args})`
        case 'unwrap-op':
            return '/*unwrap*/'
        case 'bind-op':
            return '/*bind*/'
    }
}

export const emitBinaryExpr = (binaryExpr: BinaryExpr, module: Module, ctx: Context): string => {
    // TODO
    return '/*binary*/'
}

export const emitOperand = (operand: Operand, module: Module, ctx: Context): string => {
    switch (operand.kind) {
        case 'if-expr': {
            const condition = emitExpr(operand.condition, module, ctx)
            const thenBlock = emitBlock(operand.thenBlock, module, ctx)
            const elseBlock = operand.elseBlock ? emitBlock(operand.elseBlock, module, ctx) : ''
            return `if (${condition}) ${thenBlock} ${elseBlock}`
        }
        case 'if-let-expr':
            return '/*if-let*/'
        case 'while-expr': {
            const condition = emitExpr(operand.condition, module, ctx)
            const block = emitBlock(operand.block, module, ctx)
            return `while (${condition}) ${block}`
        }
        case 'for-expr':
            return '/*for*/'
        case 'match-expr':
            return '/*match*/'
        case 'closure-expr':
            return '/*closure*/'
        case 'operand-expr':
        case 'unary-expr':
        case 'binary-expr':
            return emitExpr(operand, module, ctx)
        case 'list-expr':
            return `List(${operand.exprs.map(e => emitExpr(e, module, ctx)).join(', ')})`
        case 'string-literal':
            return `Char(${operand.value})`
        case 'char-literal':
            return `Char(${operand.value})`
        case 'int-literal':
            return `Int(${operand.value})`
        case 'float-literal':
            return `Float(${operand.value})`
        case 'bool-literal':
            return `Bool(${operand.value})`
        case 'identifier':
            return operand.names.at(-1)!.value
    }
}

export const emitParam = (param: Param, module: Module, ctx: Context): string => {
    if (param.pattern.expr.kind !== 'name') {
        return todo('destructuring')
    }
    return param.pattern.expr.value
}

export const emitBlock = (block: Block, module: Module, ctx: Context): string => {
    const statements_ = block.statements
        .map(s => emitStatement(s, module, ctx))
        .filter(s => s.length > 0)
        .map(s => indent(s))
        .join('\n')
    const statements = statements_.length > 0 ? `\n${statements_}\n` : ''
    return `{${statements}}`
}

export const emitInstance = (instance: ImplDef | TraitDef, module: Module, ctx: Context): string => {
    const fns_ = instance.block.statements
        .map(s => <FnDef>s)
        .map(f => emitFnDef(f, module, ctx, true))
        .filter(f => f.length > 0)
        .map(f => indent(f))
    const fns = fns_.length > 0 ? `\n${fns_.join(',\n')}\n` : ''
    return `{${fns}}`
}

export const indent = (str: string, level = 1): string => {
    return str.replace(/^/gm, ' '.repeat(4 * level))
}
