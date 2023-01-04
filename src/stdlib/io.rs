use std::collections::HashMap;

use crate::ast::ast::{AstPair, Identifier};
use crate::interpret::context::Definition;
use crate::interpret::value::Value;
use crate::stdlib::lib::{callee, Package};

pub fn package() -> Package {
    Package {
        name: "io".to_string(),
        definitions: HashMap::from([(
            Identifier::new("println"),
            Definition::System(|args, ctx| {
                let id = callee(&Identifier::new("+"), ctx).expect("callee not found");
                println(&args[0]);
                Ok(id.map(|_| Value::Unit))
            }),
        )]),
    }
}

pub fn println(value: &AstPair<Value>) -> () {
    println!("{}", value.1);
}
