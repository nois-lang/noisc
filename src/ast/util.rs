use crate::ast::ast::{AstContext, AstPair, Span};
use crate::parser::Rule;
use pest::error::{Error, ErrorVariant};
use pest::iterators::Pair;

pub fn children<'a>(p: &'a Pair<Rule>) -> Vec<Pair<'a, Rule>> {
    p.clone().into_inner().collect::<Vec<_>>()
}

pub fn first_child<'a>(p: &'a Pair<Rule>) -> Option<Pair<'a, Rule>> {
    children(p).into_iter().next()
}

pub fn custom_error(pair: &Pair<Rule>, message: String) -> Error<Rule> {
    Error::new_from_span(ErrorVariant::CustomError { message }, pair.as_span())
}

pub fn custom_error_span(span: &Span, ctx: &AstContext, message: String) -> Error<Rule> {
    Error::new_from_span(ErrorVariant::CustomError { message }, span.as_span(ctx))
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
