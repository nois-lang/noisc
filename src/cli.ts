import { colorError, colorWarning, prettySourceMessage } from './error'
import { getSpan } from './parser'
import { Context } from './scope'

export const parseOption = (longName: string): string | undefined => {
    const arg = process.argv.find(a => a.startsWith(`--${longName}`))
    if (arg?.includes('=')) {
        return arg.split('=')[1]
    }
    return arg !== undefined ? '' : undefined
}

export const reportErrors = (ctx: Context): void | never => {
    if (ctx.errors.length > 0) {
        for (const error of ctx.errors) {
            console.error(
                prettySourceMessage(
                    colorError(error.message),
                    error.source,
                    error.node.parseNode ? getSpan(error.node.parseNode) : undefined,
                    error.notes
                )
            )
        }
        process.exit(1)
    }
}

export const reportWarnings = (ctx: Context): void | never => {
    for (const warning of ctx.warnings) {
        console.error(
            prettySourceMessage(
                colorWarning(warning.message),
                warning.source,
                warning.node.parseNode ? getSpan(warning.node.parseNode) : undefined,
                warning.notes
            )
        )
    }
}
