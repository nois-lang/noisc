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
trait Area {
    fn area(self): Num
}

type Shape {
    Rect(width: Num, height: Num),
    Circle(radius: Num),
}

impl Area for Shape {
    fn area(self): Num {
        match self {
            Rect(width, height) -> width * height,
            Circle(radius) -> math::pi * radius ^ 2
        }
    }
}

fn main() {
    let shapes: List<Shape> = [
        Rect(width: 4, height: 2),
        Circle(radius: 12.34),
    ]
    println(shapes)
}
```

## Features

- Expressive type system
- Variant types and pattern matching
- Type class polymorphism with `traits`
- Errors are a part of a function type signature (using `std::result::Result` return type)
- Automatic memory management
- Implicit last block line returns
