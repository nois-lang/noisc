use std::collections::HashMap;
use std::rc::Rc;
use std::vec;

use crate::ast::ast_pair::AstPair;
use crate::ast::unary_operator::UnaryOperator;
use crate::error::Error;
use crate::interpret::context::Context;
use crate::interpret::value::Value;
use crate::stdlib::lib::{LibFunction, Package};
use crate::stdlib::list::Spread;

pub fn package() -> Package {
    let mut defs = HashMap::new();
    [SpreadOp::definitions()]
        .into_iter()
        .for_each(|d| defs.extend(d));
    Package {
        name: "operator".to_string(),
        definitions: defs,
    }
}

pub struct SpreadOp;

impl LibFunction for SpreadOp {
    fn name() -> Vec<String> {
        vec![UnaryOperator::Spread.to_string()]
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut Context) -> Result<Value, Error> {
        Spread::call(args, ctx)
    }
}
