/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
    moduleDirectories: ['node_modules', '<rootDir>'],
    testEnvironment: 'node',
    transform: {
        '^.+\\.(t|j)sx?$': '@swc/jest',
    },
}
