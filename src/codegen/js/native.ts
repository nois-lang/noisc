import { extractValue, jsRelName, nextVariable } from '.'
import { Context } from '../../scope'
import { trace } from '../../scope/std'
import { InstanceRelation, resolveTypeImpl } from '../../scope/trait'
import { todo } from '../../util/todo'
import { EmitNode, emitToken, emitTree, jsVariable } from './node'

export const emitTraceImpl = (rel: InstanceRelation, ctx: Context): EmitNode => {
    const typeDef = rel.forDef.def
    if (typeDef.kind === 'trait-def') {
        return todo('default Trace for trait type')
    }
    const variants = typeDef.variants.map(v => {
        const fields = v.fieldDefs.map(f => {
            const impl = resolveTypeImpl(f.type!, trace, ctx)
            if (impl) {
                ctx.moduleStack.at(-1)!.relImports.push(impl.impl)
            }
            const fAccess = `${extractValue('self')}.${f.name.value}`
            const fieldTraceCall = impl
                ? `${jsRelName(impl.impl)}().trace(${fAccess})`
                : `${fAccess}.Trace().trace(${fAccess})`
            return `"${f.name.value}: "+${extractValue(fieldTraceCall)}`
        })
        const variantStr =
            fields.length > 0 ? [`"${v.name.value}("`, fields.join('+", "+'), '")"'].join('+') : `"${v.name.value}()"`
        return `if(self.$noisVariant==="${v.name.value}"){return String.String(${variantStr});}`
    })
    const fnStr = `function(self){${variants.join('')}}`
    const fnBodyEmit = emitToken(`trace: ${fnStr}`)
    const fnEmit = emitTree([emitToken('{'), fnBodyEmit, emitToken('};')])

    const cached = nextVariable(ctx)
    const instanceEmit = emitTree([
        emitToken(`function(){if(${cached}){return ${cached};}${cached}=`),
        fnEmit,
        emitToken(`return ${cached};}`)
    ])
    return emitTree([jsVariable(cached), jsVariable(jsRelName(rel), instanceEmit, true)])
}
