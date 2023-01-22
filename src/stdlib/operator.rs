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
            NeOp::definition(),
            GtOp::definition(),
            GeOp::definition(),
            LtOp::definition(),
            LeOp::definition(),
            AndOp::definition(),
            OrOp::definition(),
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

pub struct NeOp;

impl LibFunction for NeOp {
    fn name() -> String {
        BinaryOperator::NotEquals.to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        Ne::call(args, ctx)
    }
}

pub struct GtOp;

impl LibFunction for GtOp {
    fn name() -> String {
        BinaryOperator::Greater.to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        Gt::call(args, ctx)
    }
}

pub struct GeOp;

impl LibFunction for GeOp {
    fn name() -> String {
        BinaryOperator::GreaterOrEquals.to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        Ge::call(args, ctx)
    }
}

pub struct LtOp;

impl LibFunction for LtOp {
    fn name() -> String {
        BinaryOperator::Less.to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        Lt::call(args, ctx)
    }
}

pub struct LeOp;

impl LibFunction for LeOp {
    fn name() -> String {
        BinaryOperator::LessOrEquals.to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        Le::call(args, ctx)
    }
}

pub struct AndOp;

impl LibFunction for AndOp {
    fn name() -> String {
        BinaryOperator::And.to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        And::call(args, ctx)
    }
}

pub struct OrOp;

impl LibFunction for OrOp {
    fn name() -> String {
        BinaryOperator::Or.to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        Or::call(args, ctx)
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
