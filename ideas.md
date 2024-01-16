- Infer type parameters bounds in inherent impl def
  https://rust-lang.github.io/rfcs/2089-implied-bounds.html
- `Char` should represent Unicode's grapheme, not a code point
  Therefore, `String` is a `List` of graphemes
  `Char` should provide methods `codePoints(): List<Int>` and `raw(): List<Int>`
- Self referential structs/type params?
- Futures/promises more or less straightforward, but async/await is a leaky abstraction
- std::test
- Explicit type args on constructors, Option::Some<Int>(value: 5) or Option<Int>::Some(value: 5)?
  First one follows grammar but misleading, since type params are type level, not constructor level
  Second one more semantically correct, but will require vid scope to allow type args
- Investigate strong sides of Swift
