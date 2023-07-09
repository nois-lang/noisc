import { Module } from '../ast'

export interface Package {
    path: string
    name: string
    modules: Module[]
}
