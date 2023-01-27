use std::fmt;
use std::fmt::{Display, Formatter};
use std::rc::Rc;

use crate::ast::ast_pair::AstPair;
use crate::error::Error;
use crate::interpret::context::Context;
use crate::interpret::value::Value;
use crate::stdlib::lib::LibFunction;
use crate::stdlib::math::*;

#[derive(Debug, PartialOrd, PartialEq, Eq, Clone)]
pub enum BinaryOperator {
    Add,
    Subtract,
    Multiply,
    Divide,
    Exponent,
    Remainder,
    Accessor,
    Equals,
    NotEquals,
    Greater,
    GreaterOrEquals,
    Less,
    LessOrEquals,
    And,
    Or,
}

impl BinaryOperator {
    pub fn short_circuit_condition(&self) -> Option<Value> {
        match self {
            BinaryOperator::And => Some(Value::B(false)),
            BinaryOperator::Or => Some(Value::B(true)),
            _ => None,
        }
    }

    pub fn call_function(
        &self,
    ) -> Box<fn(&[AstPair<Rc<Value>>], &mut Context) -> Result<Value, Error>> {
        Box::new(match self {
            BinaryOperator::Add => Add::call,
            BinaryOperator::Subtract => Sub::call,
            BinaryOperator::Multiply => todo!(),
            BinaryOperator::Divide => todo!(),
            BinaryOperator::Exponent => todo!(),
            BinaryOperator::Remainder => todo!(),
            BinaryOperator::Equals => Eq::call,
            BinaryOperator::NotEquals => Ne::call,
            BinaryOperator::Greater => Gt::call,
            BinaryOperator::GreaterOrEquals => Ge::call,
            BinaryOperator::Less => Lt::call,
            BinaryOperator::LessOrEquals => Le::call,
            BinaryOperator::And => And::call,
            BinaryOperator::Or => Or::call,
            BinaryOperator::Accessor => panic!(". operator must be called as a function call"),
        })
    }
}

impl Display for BinaryOperator {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "{}",
            match self {
                BinaryOperator::Add => "+",
                BinaryOperator::Subtract => "-",
                BinaryOperator::Multiply => "*",
                BinaryOperator::Divide => "/",
                BinaryOperator::Exponent => "^",
                BinaryOperator::Remainder => "%",
                BinaryOperator::Accessor => ".",
                BinaryOperator::Equals => "==",
                BinaryOperator::NotEquals => "!=",
                BinaryOperator::Greater => ">",
                BinaryOperator::GreaterOrEquals => ">=",
                BinaryOperator::Less => "<",
                BinaryOperator::LessOrEquals => "<=",
                BinaryOperator::And => "&&",
                BinaryOperator::Or => "||",
            }
        )
    }
}
