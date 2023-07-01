<h1 align="center">
  <br>
  <img src="https://raw.githubusercontent.com/nois-lang/nois/master/data/logo/logo_web.svg" width="200">
  <br>
  Nois
  <br>
</h1>

<h4 align="center">Statically typed programming language for the web</h4>

## Taste of Nois

```rust
kind Area {
    fn area(self): Float
}

type Shape {
    Rect(width: Num, height: Num),
    Circle(side: Num),
}

impl Area for Shape {
    fn area(self): Float {
        match self {
            Rect(w) -> w ^ 2,
            Circle(r) -> Math.pi * r ^ 2
        }
    }
}

fn main() {
    let shape: Shape = Rect(2)
    println(shape.area())
}
```

## Features

- Expressive type system
- Variant types and pattern matching
- Type class polymorphism with `kinds`
- Errors are a part of a function type signature
- Automatic memory management
- Implicit last block line returns
