import { encode as base64encode } from './base64'

export const toVlqSigned = (n: number): number => (n < 0 ? (-n << 1) + 1 : (n << 1) + 0)

export const encode = (n: number): string => {
    const vlqBaseShift = 5
    const vlqBaseMask = 0b011111
    const vlqContinuationBit = 0b100000

    let encoded = ''
    let digit: number
    let vlq = toVlqSigned(n)
    do {
        digit = vlq & vlqBaseMask
        vlq >>>= vlqBaseShift
        if (vlq > 0) {
            digit |= vlqContinuationBit
        }
        encoded += base64encode(digit)
    } while (vlq > 0)

    return encoded
}
