use std::cell::RefMut;
use std::collections::HashMap;

use pest::error::Error;

use crate::ast::ast::AstPair;
use crate::ast::util::custom_error_callee;
use crate::interpret::context::Context;
use crate::interpret::value::Value;
use crate::parser::Rule;
use crate::stdlib::lib::{LibFunction, Package};

pub fn package() -> Package {
    Package {
        name: "value".to_string(),
        definitions: HashMap::from([Type::definition()]),
    }
}

pub struct Type;

impl LibFunction for Type {
    fn name() -> String {
        "type".to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error<Rule>> {
        let a = args.into_iter().cloned().map(|a| a.1).collect::<Vec<_>>();
        let arg = match &a[..] {
            [a] => a,
            l => {
                return Err(custom_error_callee(
                    ctx,
                    format!(
                        "Expected (*), found {:?}",
                        l.iter().map(|a| a.value_type()).collect::<Vec<_>>()
                    ),
                ));
            }
        };
        Ok(arg.value_type())
    }
}
