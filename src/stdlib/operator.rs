use std::cell::RefMut;
use std::collections::HashMap;

use crate::ast::ast::{AstPair, BinaryOperator, UnaryOperator};
use crate::error::Error;
use crate::interpret::context::Context;
use crate::interpret::value::Value;
use crate::stdlib::lib::{LibFunction, Package};
use crate::stdlib::list::Spread;
use crate::stdlib::math::*;

// TODO: all operators
pub fn package() -> Package {
    Package {
        name: "operator".to_string(),
        definitions: HashMap::from([
            AddOp::definition(),
            SubOp::definition(),
            RemOp::definition(),
            EqOp::definition(),
            SpreadOp::definition(),
        ]),
    }
}

pub struct AddOp;

impl LibFunction for AddOp {
    fn name() -> String {
        BinaryOperator::Add.to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        Add::call(args, ctx)
    }
}

pub struct SubOp;

impl LibFunction for SubOp {
    fn name() -> String {
        BinaryOperator::Subtract.to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        Sub::call(args, ctx)
    }
}

pub struct RemOp;

impl LibFunction for RemOp {
    fn name() -> String {
        BinaryOperator::Remainder.to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        Rem::call(args, ctx)
    }
}

pub struct EqOp;

impl LibFunction for EqOp {
    fn name() -> String {
        BinaryOperator::Equals.to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        Eq::call(args, ctx)
    }
}

pub struct SpreadOp;

impl LibFunction for SpreadOp {
    fn name() -> String {
        UnaryOperator::Spread.to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        Spread::call(args, ctx)
    }
}
