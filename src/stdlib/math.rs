use std::cell::RefMut;
use std::collections::HashMap;

use crate::ast::ast::AstPair;
use crate::error::Error;
use crate::interpret::context::Context;
use crate::interpret::value::Value;
use crate::stdlib::lib::{arg_values, LibFunction, Package};

pub fn package() -> Package {
    Package {
        name: "math".to_string(),
        definitions: HashMap::from([
            Add::definition(),
            Sub::definition(),
            Rem::definition(),
            Eq::definition(),
        ]),
    }
}

pub struct Add;

impl LibFunction for Add {
    fn name() -> String {
        "add".to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        (args[0].1.clone() + args[1].1.clone()).map_err(|s| Error::from_callee(ctx, s))
    }
}

pub struct Sub;

impl LibFunction for Sub {
    fn name() -> String {
        "sub".to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        match &arg_values(args)[..] {
            [a, b] => a.clone() - b.clone(),
            [a] => -a.clone(),
            _ => unreachable!(),
        }
        .map_err(|s| Error::from_callee(ctx, s))
    }
}

pub struct Rem;

impl LibFunction for Rem {
    fn name() -> String {
        "rem".to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        (args[0].1.clone() % args[1].1.clone()).map_err(|s| Error::from_callee(ctx, s))
    }
}

pub struct Eq;

impl LibFunction for Eq {
    fn name() -> String {
        "eq".to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, _ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        Ok(Value::B(args[0].1 == args[1].1))
    }
}
