export class Result<T, E> {

    private constructor(
        private isOk: boolean,
        private result?: T,
        private error?: E
    ) {}

    unwrap(): T {
        if (this.isOk) {
            return this.result!
        } else {
            throw this.error
        }
    }

    static ok<T, E>(result: T): Result<T, E> {
        return new Result<T, E>(true, result)
    }

    static err<T, E>(err: E): Result<T, E> {
        return new Result<T, E>(false, undefined, err)
    }
}
