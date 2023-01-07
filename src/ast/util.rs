use std::cell::RefMut;

use pest::error::{Error, ErrorVariant};
use pest::iterators::Pair;

use crate::ast::ast::{AstContext, AstPair, Span};
use crate::interpret::context::Context;
use crate::parser::Rule;

pub fn children<'a>(p: &'a Pair<Rule>) -> Vec<Pair<'a, Rule>> {
    p.clone().into_inner().collect::<Vec<_>>()
}

pub fn first_child<'a>(p: &'a Pair<Rule>) -> Option<Pair<'a, Rule>> {
    children(p).into_iter().next()
}

pub fn custom_error(pair: &Pair<Rule>, message: String) -> Error<Rule> {
    Error::new_from_span(ErrorVariant::CustomError { message }, pair.as_span())
}

// TODO: custom error type with cause support
pub fn custom_error_span(span: &Span, ctx: &AstContext, message: String) -> Error<Rule> {
    Error::new_from_span(ErrorVariant::CustomError { message }, span.as_span(ctx))
}

pub fn custom_error_callee(ctx: &mut RefMut<Context>, message: String) -> Error<Rule> {
    custom_error_span(
        &ctx.scope_stack.last().unwrap().callee.clone().unwrap(),
        &ctx.ast_context,
        message,
    )
}

pub fn parse_children<A, F>(pair: &Pair<Rule>, f: F) -> Result<Vec<AstPair<A>>, Error<Rule>>
where
    F: Fn(&Pair<Rule>) -> Result<AstPair<A>, Error<Rule>>,
{
    children(pair)
        .into_iter()
        .map(|a| f(&a))
        .collect::<Result<_, _>>()
}
