use std::cell::RefMut;
use std::collections::HashMap;

use crate::ast::ast::{AstPair, BinaryOperator, UnaryOperator};
use crate::error::Error;
use crate::interpret::context::Context;
use crate::interpret::value::Value;
use crate::stdlib::lib::{arg_values, LibFunction, Package};

// TODO: dub every operator as callable function e.g. add() and eq()
pub fn package() -> Package {
    Package {
        name: "operator".to_string(),
        definitions: HashMap::from([
            Add::definition(),
            Subtract::definition(),
            Remainder::definition(),
            Equals::definition(),
            Spread::definition(),
        ]),
    }
}

pub struct Add;

impl LibFunction for Add {
    fn name() -> String {
        BinaryOperator::Add.to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        (args[0].1.clone() + args[1].1.clone()).map_err(|s| Error::from_callee(ctx, s))
    }
}

pub struct Subtract;

impl LibFunction for Subtract {
    fn name() -> String {
        BinaryOperator::Subtract.to_string()
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

pub struct Remainder;

impl LibFunction for Remainder {
    fn name() -> String {
        BinaryOperator::Remainder.to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        (args[0].1.clone() % args[1].1.clone()).map_err(|s| Error::from_callee(ctx, s))
    }
}

pub struct Equals;

impl LibFunction for Equals {
    fn name() -> String {
        BinaryOperator::Equals.to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, _ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        Ok(Value::B(args[0].1 == args[1].1))
    }
}

pub struct Spread;

impl LibFunction for Spread {
    fn name() -> String {
        UnaryOperator::Spread.to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        let arg = &args[0];
        match &arg.1 {
            Value::List { items: l, spread } => {
                if *spread {
                    Err(Error::from_callee(
                        ctx,
                        format!("list is already spread {}", arg.1),
                    ))
                } else {
                    Ok(Value::List {
                        items: l.clone(),
                        spread: true,
                    })
                }
            }
            a => Err(Error::from_callee(
                ctx,
                format!("incompatible operand: {}{}", Self::name(), a.value_type()),
            )),
        }
    }
}
