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
            Ne::definition(),
            Gt::definition(),
            Ge::definition(),
            Lt::definition(),
            Le::definition(),
            And::definition(),
            Or::definition(),
        ]),
    }
}

pub struct Add;

impl LibFunction for Add {
    fn name() -> String {
        "add".to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        (&args[0].1 + &args[1].1).map_err(|s| Error::from_callee(ctx, s))
    }
}

pub struct Sub;

impl LibFunction for Sub {
    fn name() -> String {
        "sub".to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        match arg_values(args)[..] {
            [a, b] => a - b,
            [a] => -a,
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
        (&args[0].1 % &args[1].1).map_err(|s| Error::from_callee(ctx, s))
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

pub struct Ne;

impl LibFunction for Ne {
    fn name() -> String {
        "ne".to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, _ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        Ok(Value::B(args[0].1 != args[1].1))
    }
}

pub struct Gt;

impl LibFunction for Gt {
    fn name() -> String {
        "gt".to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, _ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        Ok(Value::B(&args[0].1 > &args[1].1))
    }
}

pub struct Ge;

impl LibFunction for Ge {
    fn name() -> String {
        "ge".to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, _ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        Ok(Value::B(&args[0].1 >= &args[1].1))
    }
}

pub struct Lt;

impl LibFunction for Lt {
    fn name() -> String {
        "lt".to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, _ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        Ok(Value::B(&args[0].1 < &args[1].1))
    }
}

pub struct Le;

impl LibFunction for Le {
    fn name() -> String {
        "le".to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, _ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        Ok(Value::B(&args[0].1 <= &args[1].1))
    }
}

pub struct Not;

impl LibFunction for Not {
    fn name() -> String {
        "not".to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        (!&args[0].1).map_err(|s| Error::from_callee(ctx, s))
    }
}

// TODO: short circuiting
pub struct And;

impl LibFunction for And {
    fn name() -> String {
        "and".to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        args[0]
            .1
            .and(&args[1].1)
            .map_err(|s| Error::from_callee(ctx, s))
    }
}

pub struct Or;

impl LibFunction for Or {
    fn name() -> String {
        "or".to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        args[0]
            .1
            .or(&args[1].1)
            .map_err(|s| Error::from_callee(ctx, s))
    }
}
