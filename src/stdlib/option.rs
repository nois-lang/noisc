use std::collections::HashMap;
use std::rc::Rc;

use crate::ast::ast_pair::AstPair;
use crate::error::Error;
use crate::interpret::context::Context;
use crate::interpret::value::Value;
use crate::stdlib::lib::{arg_error, arg_values, LibFunction, Package};

pub fn package() -> Package {
    let mut defs = HashMap::new();
    [Some::definitions(), None::definitions()]
        .into_iter()
        .for_each(|d| defs.extend(d));
    Package {
        name: "option".to_string(),
        definitions: defs,
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
    fn name() -> Vec<String> {
        vec!["some".to_string()]
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut Context) -> Result<Value, Error> {
        let arg = match arg_values(args)[..] {
            [a] => a.clone(),
            _ => return Err(arg_error("(*)", args, ctx)),
        };
        Ok(Value::list(vec![arg]))
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
    fn name() -> Vec<String> {
        vec!["none".to_string()]
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut Context) -> Result<Value, Error> {
        if !args.is_empty() {
            return Err(arg_error("()", args, ctx));
        }
        Ok(Value::list(vec![]))
    }
}
