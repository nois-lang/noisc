import { Module } from '../ast'

export type Package = {
    path: string
    name: string
    modules: Module[]
    compiled: boolean
}
