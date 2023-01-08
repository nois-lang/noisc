use std::cell::RefMut;
use std::fmt::{Display, Formatter};

use pest::error::{Error as PError, LineColLocation};
use pest::error::ErrorVariant;
use pest::iterators::Pair;

use crate::ast::ast::{AstContext, Span};
use crate::interpret::context::Context;
use crate::parser::Rule;

#[derive(Debug, PartialEq, Clone)]
pub enum Error {
    Error(pest::error::Error<Rule>),
    Cause {
        error: Box<Error>,
        location: String,
        line_col: (usize, usize),
    },
}

impl Error {
    pub fn new_cause(error: Error, location: String, span: &Span, ctx: &AstContext) -> Error {
        let line_col = match Self::custom_error_span(span, ctx, String::new()).line_col {
            LineColLocation::Pos(line_col) => line_col,
            LineColLocation::Span(start_line_col, _) => start_line_col,
        };
        Error::Cause {
            error: Box::new(error),
            location,
            line_col,
        }
    }

    pub fn from_pair(pair: &Pair<Rule>, message: String) -> Error {
        Error::Error(Self::custom_error(pair, message))
    }

    pub fn from_span(span: &Span, ctx: &AstContext, message: String) -> Error {
        Error::Error(Self::custom_error_span(span, ctx, message))
    }

    pub fn from_callee(ctx: &mut RefMut<Context>, message: String) -> Error {
        Error::Error(Self::custom_error_callee(ctx, message))
    }

    pub fn message(&self) -> String {
        match self {
            Error::Error(e) => e.variant.message().to_string(),
            Error::Cause { error, .. } => error.message(),
        }
    }

    fn custom_error(pair: &Pair<Rule>, message: String) -> PError<Rule> {
        PError::new_from_span(ErrorVariant::CustomError { message }, pair.as_span())
    }

    fn custom_error_span(span: &Span, ctx: &AstContext, message: String) -> PError<Rule> {
        PError::new_from_span(ErrorVariant::CustomError { message }, span.as_span(ctx))
    }

    fn custom_error_callee(ctx: &mut RefMut<Context>, message: String) -> PError<Rule> {
        Self::custom_error_span(
            &ctx.scope_stack.last().unwrap().callee.clone().unwrap(),
            &ctx.ast_context,
            message,
        )
    }
}

impl Iterator for Error {
    type Item = Self;

    fn next(&mut self) -> Option<Self::Item> {
        match self {
            Error::Error(_) => None,
            Error::Cause { error, .. } => Some(*error.clone()),
        }
    }
}

impl Display for Error {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Error::Error(e) => write!(f, "{}", e.to_string()),
            Error::Cause {
                error,
                location,
                line_col,
            } => write!(
                f,
                "{}\n\t@ {:<8} ({}:{})",
                error, location, line_col.0, line_col.1,
            ),
        }
    }
}
