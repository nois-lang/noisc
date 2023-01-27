use std::rc::Rc;

use crate::ast::ast_pair::AstPair;
use crate::error::Error;
use crate::interpret::context::Context;
use crate::interpret::value::Value;

pub trait Evaluate {
    fn eval(self, ctx: &mut Context) -> Result<AstPair<Rc<Value>>, Error>;
}
