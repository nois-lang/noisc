use crate::ast::ast::{AstPair, Expression, Operand};
use crate::ast::util::custom_error_span;
use crate::interpret::context::Context;
use crate::interpret::value::Value;
use crate::parser::Rule;
use pest::error::Error;

pub trait Evaluate {
    fn eval(&self, ctx: &mut Context) -> Result<Value, Error<Rule>>;
}

impl Evaluate for AstPair<Expression> {
    fn eval(&self, ctx: &mut Context) -> Result<Value, Error<Rule>> {
        match &self.1 {
            Expression::Operand(op) => op.eval(ctx),
            Expression::Unary { .. } => todo!(),
            Expression::Binary { .. } => todo!(),
            Expression::MatchExpression { .. } => todo!(),
        }
    }
}

impl Evaluate for AstPair<Operand> {
    fn eval(&self, _ctx: &mut Context) -> Result<Value, Error<Rule>> {
        match &self.1 {
            Operand::Integer(i) => Ok(Value::I(*i)),
            Operand::Float(f) => Ok(Value::F(*f)),
            Operand::String(s) => Ok(Value::List(s.chars().map(|c| Value::C(c)).collect())),
            Operand::FunctionInit(_) => todo!(),
            Operand::FunctionCall { .. } => todo!(),
            Operand::Identifier(_) => todo!(),
            _ => Err(custom_error_span(
                &self.0,
                format!("Operand {:?} cannot be evaluated", self.1),
            )),
        }
    }
}
