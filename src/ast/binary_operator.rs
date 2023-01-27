use std::fmt;
use std::fmt::{Display, Formatter};
use std::rc::Rc;

use crate::ast::ast_pair::AstPair;
use crate::error::Error;
use crate::interpret::context::Context;
use crate::interpret::value::Value;
use crate::stdlib::lib::LibFunction;
use crate::stdlib::operator::{AddOp, AndOp, EqOp, GeOp, GtOp, LeOp, LtOp, NeOp, OrOp, SubOp};

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
            BinaryOperator::Add => AddOp::call,
            BinaryOperator::Subtract => SubOp::call,
            BinaryOperator::Multiply => todo!(),
            BinaryOperator::Divide => todo!(),
            BinaryOperator::Exponent => todo!(),
            BinaryOperator::Remainder => todo!(),
            BinaryOperator::Equals => EqOp::call,
            BinaryOperator::NotEquals => NeOp::call,
            BinaryOperator::Greater => GtOp::call,
            BinaryOperator::GreaterOrEquals => GeOp::call,
            BinaryOperator::Less => LtOp::call,
            BinaryOperator::LessOrEquals => LeOp::call,
            BinaryOperator::And => AndOp::call,
            BinaryOperator::Or => OrOp::call,
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
