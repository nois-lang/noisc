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
use std::{ math::pi, iter::MapAdapter }

trait Area {
    area = fn(self): Float
}

type Shape {
    Rect(width: Float, height: Float),
    Circle(radius: Float),
}

impl Area for Shape {
    area = fn(self): Float {
        match self {
            Rect(width, height) { width * height }
            Circle(radius) { pi * radius ^ 2. }
        }
    }
}

pub fn main() {
    let shapes: List<Shape> = [
        Rect(width = 4., height = 2.),
        Circle(radius = 12.34),
    ]
    shapes
        .iter()
        .map(area)
        .collect<List<_>>()
        .show()
        .println()
}
```

## Features

- Expressive type system
- Automatic memory management
- Variant types and pattern matching
- Type class polymorphism with `traits`
- Errors are a part of a function type signature (using `std::result::Result` return type)
- Everything* is an expression

## Roadmap

| Feature                     | Milestone | Status |
| --------------------------- | --------- | ------ |
| Lexing                      | 0.1.0     | ✅     |
| Parsing                     | 0.1.0     | ✅     |
| Semantic checking           | 0.1.0     | ✅     |
| Type checking               | 0.1.0     | ✅     |
| Code generation (JS target) | 0.1.0     | ✅     |
| Package support             | 0.1.0     | ✅     |
| Useful standard library     | 0.1.0     | 🚧     |

> - ✅ Implemented
> - 🚧 In progress
> - ❌ TBD
