import {rules} from './parser/parser'
import {followTokens, transformFirstTokens} from './parser/locate-token'
import {generateParsingTable} from './parser/table'

const transforms = [...rules.values()].flatMap(r => r.branches.map(b => ({name: r.name, branch: b})))
console.table(transforms.map(t => [t.name, transformFirstTokens(t), followTokens(t.name)]))

console.table([...generateParsingTable().entries()].map(([k, v]) => ({k, ...Object.fromEntries([...v.entries()].map(([k, t]) => [k, t.branch]))})))
