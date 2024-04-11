import { extractValue, jsRelName, nextVariable } from '.'
import { Context } from '../../scope'
import { string, trace } from '../../scope/std'
import { InstanceRelation, resolveTypeImpl } from '../../scope/trait'
import { resolveVid } from '../../scope/vid'
import { todo } from '../../util/todo'
import { EmitNode, emitToken, emitTree, jsVariable } from './node'

export const emitTraceImpl = (rel: InstanceRelation, ctx: Context): EmitNode => {
    const typeDef = rel.forDef.def
    if (typeDef.kind === 'trait-def') {
        return todo('default Trace for trait type')
    }
    ctx.moduleStack.at(-1)!.imports.push(resolveVid(string.identifier, ctx)!)
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
        return { v: v.name.value, str: variantStr }
    })
    const variantsStr =
        variants.length === 1
            ? `return String.String(${variants[0].str})`
            : variants.map(({ v, str }) => `if(self.$noisVariant==="${v}"){return String.String(${str});}`).join('')
    const fnBodyEmit = emitToken(`trace: function(self){${variantsStr}}`)
    const fnEmit = emitTree([emitToken('{'), fnBodyEmit, emitToken('};')])

    const cached = nextVariable(ctx)
    const instanceEmit = emitTree([
        emitToken(`function(){if(${cached}){return ${cached};}${cached}=`),
        fnEmit,
        emitToken(`return ${cached};}`)
    ])
    return emitTree([jsVariable(cached), jsVariable(jsRelName(rel), instanceEmit, true)])
}
