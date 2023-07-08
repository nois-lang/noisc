import { Context, semanticError } from '../scope'
import { Generic, Type } from '../ast/type'
import { idToVid, resolveVid, vidToString, VirtualIdentifier } from '../scope/vid'
import { todo } from '../util/todo'

export interface Identified {
    vid: VirtualIdentifier
}

export const identifyType = (type: Type, ctx: Context): boolean => {
    if (type.kind === 'variant-type' && type.vid) return true
    const module = ctx.moduleStack.at(-1)!

    switch (type.kind) {
        case 'variant-type':
            const vid = idToVid(type.identifier)
            if ((module.implDef || module.kindDef) && type.identifier.name.value === 'Self') {
                type.vid = vid
                return true
            }
            const vidMatch = resolveVid(vid, ctx)
            if (!vidMatch) {
                ctx.errors.push(semanticError(ctx, type, `identifier ${vidToString(vid)} not found`))
                return false
            }
            if (vidMatch.def.kind !== 'type-def') {
                ctx.errors.push(semanticError(ctx, type, `identifier ${vidToString(vid)} is not a type`))
                return false
            }
            const typeDef = vidMatch.def
            type.vid = vidMatch.qualifiedVid
            typeDef.generics.forEach(g => identifyGeneric(g, ctx))
            break
        case 'fn-type':
            todo('identify fn-type')
            break
    }
    return true
}

export const identifyGeneric = (generic: Generic, ctx: Context): void => {
    // TODO
}
