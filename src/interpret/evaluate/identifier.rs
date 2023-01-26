use std::cell::RefMut;
use std::rc::Rc;

use log::debug;

use crate::ast::ast::{AstPair, Identifier};
use crate::error::Error;
use crate::interpret::context::Context;
use crate::interpret::evaluate::Evaluate;
use crate::interpret::value::Value;

impl Evaluate for AstPair<Rc<Identifier>> {
    fn eval(self, ctx: &mut RefMut<Context>) -> Result<AstPair<Rc<Value>>, Error> {
        debug!("eval {:?}", &self);
        let res = match ctx.find_definition(&self.1) {
            Some(res) => res.clone().eval(ctx),
            None => Err(Error::from_span(
                &self.0,
                &ctx.ast_context,
                format!("identifier '{}' not found", self.1),
            )),
        };
        debug!("result {:?}: {:?}", &self, res);
        res
    }
}

#[cfg(test)]
mod tests {}
