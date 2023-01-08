use pest::iterators::Pair;

use crate::ast::ast::AstPair;
use crate::error::Error;
use crate::parser::Rule;

pub fn children<'a>(p: &'a Pair<Rule>) -> Vec<Pair<'a, Rule>> {
    p.clone().into_inner().collect::<Vec<_>>()
}

pub fn first_child<'a>(p: &'a Pair<Rule>) -> Option<Pair<'a, Rule>> {
    children(p).into_iter().next()
}

pub fn parse_children<A, F>(pair: &Pair<Rule>, f: F) -> Result<Vec<AstPair<A>>, Error>
    where
        F: Fn(&Pair<Rule>) -> Result<AstPair<A>, Error>,
{
    children(pair)
        .into_iter()
        .map(|a| f(&a))
        .collect::<Result<_, _>>()
}
