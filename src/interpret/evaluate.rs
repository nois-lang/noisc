use std::cell::RefMut;
use std::rc::Rc;

use crate::ast::ast_pair::AstPair;
use crate::error::Error;
use crate::interpret::context::Context;
use crate::interpret::value::Value;

pub trait Evaluate {
    fn eval(self, ctx: &mut RefMut<Context>) -> Result<AstPair<Rc<Value>>, Error>;
}
