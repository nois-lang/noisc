use std::cell::RefMut;
use std::collections::HashMap;

use crate::ast::ast::AstPair;
use crate::error::Error;
use crate::interpret::context::Context;
use crate::interpret::value::Value;
use crate::stdlib::lib::{arg_error, LibFunction, Package};

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
        let a = args.into_iter().cloned().map(|a| a.1).collect::<Vec<_>>();
        let arg = match &a[..] {
            [a] => a,
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
        let a = args.into_iter().cloned().map(|a| a.1).collect::<Vec<_>>();
        let (arg, vt) = match &a[..] {
            [a, vt @ Value::Type(..)] => (a, vt),
            [a, vt @ Value::List { items, .. }] if is_type_list(&items) => (a, vt),
            _ => return Err(arg_error("(*, T)", args, ctx)),
        };
        arg.to(vt).ok_or(Error::from_callee(
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
