use std::cell::RefMut;
use std::rc::Rc;

use log::debug;

use crate::ast::ast::{AstPair, Block};
use crate::error::Error;
use crate::interpret::context::Context;
use crate::interpret::evaluate::Evaluate;
use crate::interpret::value::Value;

impl Evaluate for AstPair<Rc<Block>> {
    fn eval(self, ctx: &mut RefMut<Context>) -> Result<AstPair<Rc<Value>>, Error> {
        debug!("eval {:?}", &self);
        let mut last_res = self.with(Rc::new(Value::Unit));
        for statement in &self.1.statements {
            last_res = statement.map(Rc::clone).eval(ctx)?;
            let scope = ctx.scope_stack.last().unwrap();
            if let Some(rv) = scope.return_value.as_ref() {
                debug!("block interrupted by return, value: {:?}", &rv);
                return Ok(statement.with(Rc::clone(rv)));
            }
        }
        debug!("block return value: {:?}", last_res);
        Ok(last_res)
    }
}

#[cfg(test)]
mod tests {}
