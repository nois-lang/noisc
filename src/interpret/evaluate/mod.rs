use std::cell::RefMut;
use std::rc::Rc;

use crate::ast::ast::AstPair;
use crate::error::Error;
use crate::interpret::context::Context;
use crate::interpret::value::Value;

pub mod block;
pub mod definition;
pub mod expression;
pub mod function_call;
pub mod function_init;
pub mod identifier;
pub mod operand;
pub mod statement;
pub mod value;

pub trait Evaluate {
    fn eval(self, ctx: &mut RefMut<Context>) -> Result<AstPair<Rc<Value>>, Error>;
}
