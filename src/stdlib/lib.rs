use std::cell::RefMut;
use std::collections::HashMap;
use std::mem::take;
use std::rc::Rc;

use crate::ast::ast_pair::{AstPair, Span};
use crate::ast::identifier::Identifier;
use log::debug;

use crate::error::Error;
use crate::interpret::context::{Context, Scope, SysFunction};
use crate::interpret::definition::Definition;
use crate::interpret::evaluate::Evaluate;
use crate::interpret::value::Value;
use crate::stdlib::*;
use crate::util::vec_to_string_paren;

#[derive(Debug)]
pub struct Package {
    pub name: String,
    pub definitions: HashMap<Identifier, Definition>,
}

pub fn stdlib() -> Vec<Package> {
    vec![
        io::package(),
        math::package(),
        operator::package(),
        list::package(),
        value::package(),
        option::package(),
    ]
}

pub trait LibFunction {
    fn name() -> String;

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut RefMut<Context>) -> Result<Value, Error>;

    fn call_fn(
        args: &[AstPair<Rc<Value>>],
        ctx: &mut RefMut<Context>,
    ) -> Result<AstPair<Value>, Error> {
        debug!("stdlib function call {:?}", Self::name(),);
        let arguments: Vec<AstPair<Rc<Value>>> = args
            .iter()
            .map(|a| a.clone().eval(ctx))
            .collect::<Result<_, _>>()?;

        let res = Self::call(&arguments, ctx);
        debug!(
            "stdlib function call {:?}, args: {:?}, result: {:?}",
            Self::name(),
            arguments,
            res
        );

        let scope = ctx.scope_stack.last().unwrap();
        let callee = scope
            .method_callee
            .as_ref()
            .map(|c| c.0)
            .or(scope.callee)
            .expect("callee not found");
        res.map(|v| AstPair::from_span(&callee, v))
    }

    fn definition() -> (Identifier, Definition) {
        (
            Identifier(Self::name()),
            Definition::System(SysFunction(|args, ctx| Self::call_fn(args, ctx))),
        )
    }
}

pub fn arg_error(
    expected_type: &str,
    args: &[AstPair<Rc<Value>>],
    ctx: &mut RefMut<Context>,
) -> Error {
    Error::from_callee(
        ctx,
        format!(
            "expected {}, found {}",
            expected_type,
            vec_to_string_paren(args.iter().map(|l| l.1.value_type()).collect())
        ),
    )
}

pub fn arg_values(args: &[AstPair<Rc<Value>>]) -> Vec<&Value> {
    args.iter().map(|a| a.1.as_ref()).collect::<Vec<_>>()
}

pub fn run_closure(
    closure: &AstPair<Rc<Value>>,
    arguments: Option<Rc<Vec<AstPair<Rc<Value>>>>>,
    callee: Option<Span>,
    ctx: &mut RefMut<Context>,
) -> Result<AstPair<Rc<Value>>, Error> {
    ctx.scope_stack.push(take(
        Scope::new("<closure>".to_string())
            .with_callee(callee)
            .with_arguments(arguments),
    ));
    debug!("push scope @{}", &ctx.scope_stack.last().unwrap().name);

    let next = closure.map(Rc::clone).eval(ctx);

    debug!("pop scope @{}", &ctx.scope_stack.last().unwrap().name);
    ctx.scope_stack.pop();

    next
}
