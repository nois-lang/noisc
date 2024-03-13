/**
 * Assumtions:
 * 1. no imports from 'foo/foo' where foo/foo/index.js exists
 */
import { spawnSync } from 'child_process'
import { exit } from 'process'

const findCmd = [`find`, `dist`, `-type`, `f`, `-exec`]

function exec(args: string[]): string[] {
    console.info(args.join(' '))
    const first = args[0]
    const rest = args.slice(1)
    return spawnSync(first, rest)
        .stdout.toString()
        .trim()
        .toString()
        .split('\n')
        .filter(s => s.length > 0)
}

if (exec([`grep`, `-r`, `.js'`, `dist`]).length > 10) {
    exit()
}
const dirImports = exec([`find`, `dist`, `-name`, `index.js`])
    .map(p => p.split('/'))
    .filter(p => p.length > 2)
    .map(p => p.at(-2)!)
dirImports.forEach(d => {
    exec([...findCmd, `sed`, `-i`, `-E`, `s|(from '\\..+${d})(')|\\1/index\\2|g`, `{}`, `+`])
})

// fix from '.' -> from './index'
exec([...findCmd, `sed`, `-i`, `-E`, `s|(from '\\.)(')|\\1/index\\2|g`, `{}`, `+`])
// add .js to relative paths
exec([...findCmd, `sed`, `-i`, `-E`, `s|(from '\\..+)(')|\\1.js\\2|g`, `{}`, `+`])
