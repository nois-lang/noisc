use crate::ast::ast::{AstPair, Span};
use crate::parser::Rule;
use pest::error::{Error, ErrorVariant};
use pest::iterators::Pair;

pub fn from_pair<A>(p: &Pair<Rule>, ast: A) -> AstPair<A> {
    AstPair(p.as_span().into(), ast)
}

pub fn from_span<A>(s: &Span, ast: A) -> AstPair<A> {
    AstPair(s.clone().into(), ast)
}

pub fn children<'a>(p: &'a Pair<Rule>) -> Vec<Pair<'a, Rule>> {
    p.clone().into_inner().collect::<Vec<_>>()
}

pub fn first_child<'a>(p: &'a Pair<Rule>) -> Option<Pair<'a, Rule>> {
    children(p).into_iter().next()
}

pub fn custom_error(pair: &Pair<Rule>, message: String) -> Error<Rule> {
    Error::new_from_span(ErrorVariant::CustomError { message }, pair.as_span())
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
