use std::cell::RefMut;

use crate::ast::ast_context::AstContext;
use crate::ast::ast_pair::AstPair;
use pest::iterators::Pair;

use crate::error::Error;
use crate::parser::Rule;

pub fn children<'a>(p: &'a Pair<Rule>) -> Vec<Pair<'a, Rule>> {
    p.clone().into_inner().collect::<Vec<_>>()
}

pub fn first_child<'a>(p: &'a Pair<Rule>) -> Option<Pair<'a, Rule>> {
    children(p).into_iter().next()
}

pub fn parse_children<A, F>(
    pair: &Pair<Rule>,
    f: F,
    ctx: &mut RefMut<AstContext>,
) -> Result<Vec<AstPair<A>>, Error>
where
    F: Fn(&Pair<Rule>, &mut RefMut<AstContext>) -> Result<AstPair<A>, Error>,
{
    children(pair)
        .into_iter()
        .map(|a| f(&a, ctx))
        .collect::<Result<_, _>>()
}
