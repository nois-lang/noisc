use std::cell::RefMut;
use std::collections::HashMap;

use pest::error::Error;

use crate::ast::ast::{AstPair, BinaryOperator};
use crate::ast::util::custom_error_callee;
use crate::interpret::context::Context;
use crate::interpret::value::Value;
use crate::parser::Rule;
use crate::stdlib::lib::{LibFunction, Package};

pub fn package() -> Package {
    Package {
        name: "binary_operator".to_string(),
        definitions: HashMap::from([
            Add::definition(),
            Subtract::definition(),
            Remainder::definition(),
            Equals::definition(),
        ]),
    }
}

pub struct Add;

impl LibFunction for Add {
    fn name() -> String {
        BinaryOperator::Add.to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error<Rule>> {
        (args[0].1.clone() + args[1].1.clone()).map_err(|s| custom_error_callee(ctx, s))
    }
}

pub struct Subtract;

impl LibFunction for Subtract {
    fn name() -> String {
        BinaryOperator::Subtract.to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error<Rule>> {
        (args[0].1.clone() - args[1].1.clone()).map_err(|s| custom_error_callee(ctx, s))
    }
}

pub struct Remainder;

impl LibFunction for Remainder {
    fn name() -> String {
        BinaryOperator::Remainder.to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error<Rule>> {
        (args[0].1.clone() % args[1].1.clone()).map_err(|s| custom_error_callee(ctx, s))
    }
}

pub struct Equals;

impl LibFunction for Equals {
    fn name() -> String {
        BinaryOperator::Equals.to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, _ctx: &mut RefMut<Context>) -> Result<Value, Error<Rule>> {
        Ok(Value::B(args[0].1 == args[1].1))
    }
}
