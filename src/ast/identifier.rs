use std::fmt;
use std::fmt::{Display, Formatter};
use std::rc::Rc;

use log::debug;

use crate::ast::ast_pair::AstPair;
use crate::error::Error;
use crate::interpret::context::Context;
use crate::interpret::evaluate::Evaluate;
use crate::interpret::value::Value;

#[derive(Debug, PartialOrd, PartialEq, Clone, Eq, Hash)]
pub struct Identifier(pub String);

impl Identifier {
    pub fn new(name: &str) -> Identifier {
        Identifier(name.to_string())
    }
}

impl Display for Identifier {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl Evaluate for AstPair<Rc<Identifier>> {
    fn eval(self, ctx: &mut Context) -> Result<AstPair<Rc<Value>>, Error> {
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
mod test {}
