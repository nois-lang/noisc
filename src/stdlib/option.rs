use std::cell::RefMut;
use std::collections::HashMap;

use crate::ast::ast::AstPair;
use crate::error::Error;
use crate::interpret::context::Context;
use crate::interpret::value::Value;
use crate::stdlib::lib::{arg_error, LibFunction, Package};

pub fn package() -> Package {
    Package {
        name: "option".to_string(),
        definitions: HashMap::from([Some::definition(), None::definition()]),
    }
}

/// Construct option type from a value
///
///     some(*) -> [*]
///
/// Examples:
///
///     some(12) -> [12]
///
pub struct Some;

impl LibFunction for Some {
    fn name() -> String {
        "some".to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        let arg = match &args.into_iter().map(|a| a.1.clone()).collect::<Vec<_>>()[..] {
            [a] => a.clone(),
            _ => return Err(arg_error("(*)", args, ctx)),
        };
        Ok(Value::List {
            items: vec![arg],
            spread: false,
        })
    }
}

/// Construct empty option type
///
///     none() -> [*]
///
/// Examples:
///
///     none() -> []
///
pub struct None;

impl LibFunction for None {
    fn name() -> String {
        "none".to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        if !args.is_empty() {
            return Err(arg_error("()", args, ctx));
        }
        Ok(Value::list(vec![]))
    }
}
