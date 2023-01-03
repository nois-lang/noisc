use crate::ast::ast::Identifier;
use crate::interpret::context::Definition;
use crate::interpret::value::Value;
use crate::stdlib::lib::Package;
use std::collections::HashMap;

pub fn package() -> Package {
    Package {
        name: "io".to_string(),
        definitions: HashMap::from([(
            Identifier("println".to_string()),
            Definition::System(Box::from(|args: Vec<&Value>| {
                println(args.first().unwrap());
                Value::Unit
            })),
        )]),
    }
}

pub fn println(value: &Value) -> () {
    println!("{:#?}", value);
}
