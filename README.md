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
use std::math::pi

trait Area {
    fn area(self): Float
}

type Shape {
    Rect(width: Float, height: Float),
    Circle(radius: Float),
}

impl Area for Shape {
    fn area(self): Float {
        match self {
            Shape::Rect(width, height) { width * height }
            Shape::Circle(radius) { pi * radius ^ 2. }
        }
    }
}

fn main() {
    let shapes: List<Shape> = [
        Shape::Rect(width: 4., height: 2.),
        Shape::Circle(radius: 12.34),
    ]
    println(shapes.iter().map(Area::area).collect<List<_>>())
}
```

## Features

- Expressive type system
- Variant types and pattern matching
- Type class polymorphism with `traits`
- Errors are a part of a function type signature (using `std::result::Result` return type)
- Automatic memory management
- Implicit last block line returns

## Roadmap

| Feature                     | Milestone | Status |
| --------------------------- | --------- | ------ |
| Lexing                      | 0.1.0     | ✅     |
| Parsing                     | 0.1.0     | ✅     |
| Semantic checking           | 0.1.0     | 🚧     |
| Type checking               | 0.1.0     | 🚧     |
| Code generation (JS target) | 0.1.0     | ❌     |

> - ✅ Implemented
> - 🚧 In progress
> - ❌ TBD
