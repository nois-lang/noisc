use std::cell::RefMut;
use std::collections::HashMap;

use crate::ast::ast::AstPair;
use crate::error::Error;
use crate::interpret::context::Context;
use crate::interpret::value::Value;
use crate::stdlib::lib::{LibFunction, Package};
use crate::util::vec_to_string;

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
            l => {
                return Err(Error::from_callee(
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
            l => {
                return Err(Error::from_callee(
                    ctx,
                    format!(
                        "Expected (*, T), found {}",
                        vec_to_string(l.iter().map(|a| a.value_type()).collect::<Vec<_>>())
                    ),
                ));
            }
        };
        arg.to(vt).ok_or(Error::from_callee(
            ctx,
            format!(
                "Unable to cast value {} from {} to {}",
                arg,
                arg.value_type(),
                vt
            ),
        ))
    }
}
