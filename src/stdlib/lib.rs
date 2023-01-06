use std::cell::RefMut;
use std::collections::HashMap;

use log::debug;
use pest::error::Error;

use crate::ast::ast::{AstPair, Identifier};
use crate::ast::util::custom_error_span;
use crate::interpret::context::{Context, Definition};
use crate::interpret::evaluate::Evaluate;
use crate::interpret::value::Value;
use crate::parser::Rule;
use crate::stdlib::{binary_operator, io, list};

#[derive(Debug)]
pub struct Package {
    pub name: String,
    pub definitions: HashMap<Identifier, Definition>,
}

pub fn stdlib() -> Vec<Package> {
    vec![io::package(), binary_operator::package(), list::package()]
}

pub trait LibFunction {
    fn name() -> String;

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, String>;

    fn call_fn(
        args: Vec<AstPair<Value>>,
        ctx: &mut RefMut<Context>,
    ) -> Result<AstPair<Value>, Error<Rule>> {
        let arguments: Vec<AstPair<Value>> = args
            .iter()
            .map(|a| a.eval(ctx, false))
            .collect::<Result<_, _>>()?;

        let res = Self::call(&arguments, ctx);
        debug!(
            "stdlib function call {:?}, params: {:?}, result: {:?}",
            Self::name(),
            &arguments,
            &res
        );

        let callee = &ctx
            .scope_stack
            .last()
            .unwrap()
            .clone()
            .callee
            .expect("callee not found");
        res.map(|v| AstPair::from_span(callee, v))
            .map_err(|s| custom_error_span(callee, &ctx.ast_context, s))
    }

    fn definition() -> (Identifier, Definition) {
        (
            Identifier(Self::name()),
            Definition::System(|args, ctx| Self::call_fn(args, ctx)),
        )
    }
}
