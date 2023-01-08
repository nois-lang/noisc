use std::cell::RefMut;
use std::collections::HashMap;

use crate::ast::ast::AstPair;
use crate::error::Error;
use crate::interpret::context::Context;
use crate::interpret::value::Value;
use crate::stdlib::lib::{LibFunction, Package};

pub fn package() -> Package {
    Package {
        name: "io".to_string(),
        definitions: HashMap::from([Println::definition()]),
    }
}

pub struct Println;

impl LibFunction for Println {
    fn name() -> String {
        "println".to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, _ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        println!(
            "{}",
            args.into_iter()
                .map(|a| a.1.to_string())
                .collect::<Vec<_>>()
                .join(" ")
        );
        Ok(Value::Unit)
    }
}
