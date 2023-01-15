use std::cell::RefMut;
use std::collections::HashMap;

use crate::ast::ast::AstPair;
use crate::error::Error;
use crate::interpret::context::Context;
use crate::interpret::value::Value;
use crate::stdlib::lib::{arg_error, arg_values, LibFunction, Package};

pub fn package() -> Package {
    Package {
        name: "value".to_string(),
        definitions: HashMap::from([Type::definition(), To::definition()]),
    }
}

pub struct Type;

impl LibFunction for Type {
    fn name() -> String {
        "type".to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        let arg = match &arg_values(args)[..] {
            [a] => a.clone(),
            _ => return Err(arg_error("(*)", args, ctx)),
        };
        Ok(arg.value_type())
    }
}

pub struct To;

impl LibFunction for To {
    fn name() -> String {
        "to".to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        let is_type_list = |l: &Vec<Value>| match l[..] {
            [Value::Type(..)] => true,
            _ => false,
        };
        let (arg, vt) = match &arg_values(args)[..] {
            [a, vt @ Value::Type(..)] => (a.clone(), vt.clone()),
            [a, vt @ Value::List { items, .. }] if is_type_list(&items) => (a.clone(), vt.clone()),
            _ => return Err(arg_error("(*, T)", args, ctx)),
        };
        arg.to(&vt).ok_or(Error::from_callee(
            ctx,
            format!(
                "unable to cast value {} from {} to {}",
                arg,
                arg.value_type(),
                vt
            ),
        ))
    }
}
