use std::cell::RefMut;
use std::collections::HashMap;

use crate::ast::ast::{AstPair, BinaryOperator};
use crate::interpret::context::Context;
use crate::interpret::value::Value;
use crate::stdlib::lib::{LibFunction, Package};

pub fn package() -> Package {
    Package {
        name: "binary_operator".to_string(),
        definitions: HashMap::from([Add::definition()]),
    }
}

pub struct Add;

impl LibFunction for Add {
    fn name() -> String {
        BinaryOperator::Add.to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, _ctx: &mut RefMut<Context>) -> Result<Value, String> {
        &args[0].1 + &args[1].1
    }
}
