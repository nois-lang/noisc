use std::collections::HashMap;

use crate::ast::ast::{AstPair, Identifier};
use crate::interpret::context::Definition;
use crate::interpret::evaluate::Evaluate;
use crate::interpret::value::Value;
use crate::stdlib::lib::{callee, Package};

pub fn package() -> Package {
    Package {
        name: "io".to_string(),
        definitions: HashMap::from([(
            Identifier::new("println"),
            Definition::System(|args, ctx| {
                let c = callee(ctx).expect("callee not found");
                let a = args[0].eval(ctx, true)?;
                println(&a);
                Ok(AstPair::from_span(&c, Value::Unit))
            }),
        )]),
    }
}

pub fn println(value: &AstPair<Value>) -> () {
    println!("{}", value.1);
}
