use std::cell::RefMut;
use std::collections::HashMap;

use crate::ast::ast::{AstPair, UnaryOperator};
use crate::error::Error;
use crate::interpret::context::Context;
use crate::interpret::value::Value;
use crate::stdlib::lib::{LibFunction, Package};

pub fn package() -> Package {
    Package {
        name: "unary_operator".to_string(),
        definitions: HashMap::from([Spread::definition()]),
    }
}

pub struct Spread;

impl LibFunction for Spread {
    fn name() -> String {
        UnaryOperator::Spread.to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        let arg = &args[0];
        match &arg.1 {
            Value::List { items: l, spread } => {
                if *spread {
                    Err(Error::from_callee(
                        ctx,
                        format!("list is already spread {}", arg.1),
                    ))
                } else {
                    Ok(Value::List {
                        items: l.clone(),
                        spread: true,
                    })
                }
            }
            a => Err(Error::from_callee(
                ctx,
                format!("incompatible operand: {}{}", Self::name(), a.value_type()),
            )),
        }
    }
}
