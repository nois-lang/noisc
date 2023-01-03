use crate::ast::ast::Identifier;
use crate::interpret::context::Definition;
use crate::interpret::value::Value;
use crate::stdlib::lib::Package;
use std::collections::HashMap;

pub fn package() -> Package {
    Package {
        name: "binary_operator".to_string(),
        definitions: HashMap::from([(
            Identifier::new("+"),
            Definition::System(|args, _| add(&args[0], &args[1])),
        )]),
    }
}

pub fn add(a: &Value, b: &Value) -> Value {
    a + b
}
