use std::fmt;
use std::fmt::{Debug, Formatter};

use pest::iterators::Pair;

use crate::ast::ast_context::AstContext;
use crate::parser::Rule;

#[derive(PartialOrd, PartialEq, Eq, Clone)]
pub struct AstPair<A>(pub Span, pub A);

impl<A> AstPair<A> {
    pub fn from_pair(p: &Pair<Rule>, ast: A) -> AstPair<A> {
        AstPair(p.as_span().into(), ast)
    }

    pub fn from_span(s: &Span, ast: A) -> AstPair<A> {
        AstPair(*s, ast)
    }

    pub fn map<T, F>(&self, f: F) -> AstPair<T>
    where
        F: FnOnce(&A) -> T,
    {
        let t = f(&self.1);
        AstPair(self.0, t)
    }

    pub fn map_into<T, F>(self, f: F) -> AstPair<T>
    where
        F: FnOnce(A) -> T,
    {
        let t = f(self.1);
        AstPair(self.0, t)
    }

    pub fn with<T>(&self, t: T) -> AstPair<T> {
        AstPair(self.0, t)
    }

    pub fn flat_map<T, E, F>(&self, f: F) -> Result<AstPair<T>, E>
    where
        F: Fn(&A) -> Result<T, E>,
    {
        let r = f(&self.1);
        r.map(|t| AstPair(self.0, t))
    }

    pub fn as_ref(&self) -> AstPair<&A> {
        AstPair(self.0, &self.1)
    }
}

impl<A> AstPair<&A> {
    pub fn cloned(&self) -> AstPair<A>
    where
        A: Clone,
    {
        AstPair(self.0, (self.1).clone())
    }
}

impl<T: Debug> Debug for AstPair<T> {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        Debug::fmt(&self.1, f)
    }
}

#[derive(Debug, PartialOrd, PartialEq, Eq, Clone, Copy, Default)]
pub struct Span {
    pub start: usize,
    pub end: usize,
}

impl Span {
    pub fn as_span<'a>(&self, ctx: &'a AstContext) -> pest::Span<'a> {
        pest::Span::new(&ctx.input, self.start, self.end)
            .unwrap_or_else(|| panic!("failed to convert {self:?}"))
    }
}

impl<'a> From<pest::Span<'a>> for Span {
    fn from(span: pest::Span<'a>) -> Self {
        Self {
            start: span.start(),
            end: span.end(),
        }
    }
}
