import { encode } from "./base64vlq"

describe('base64vlq', () => {
    it('encode', () => {
        expect(encode(0)).toEqual('A')
        expect(encode(1)).toEqual('C')
        expect(encode(2)).toEqual('E')
        expect(encode(3)).toEqual('G')
        expect(encode(-100)).toEqual('pG')
        expect(encode(100)).toEqual('oG')
    })
})
