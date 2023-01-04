use std::collections::HashMap;

use crate::ast::ast::Identifier;
use crate::ast::util::custom_error_span;
use crate::interpret::context::Definition;
use crate::interpret::value::Value;
use crate::stdlib::lib::{callee, Package};

pub fn package() -> Package {
    Package {
        name: "binary_operator".to_string(),
        definitions: HashMap::from([(
            Identifier::new("+"),
            Definition::System(|args, ctx| {
                let id = callee(&Identifier::new("+"), ctx).expect("callee not found");
                add(&args[0].1, &args[1].1)
                    .map(|r| id.map(|_| r.clone()))
                    .map_err(|m| custom_error_span(&args[0].0, &ctx.ast_context, m))
            }),
        )]),
    }
}

pub fn add(a: &Value, b: &Value) -> Result<Value, String> {
    a + b
}
