use std::cell::RefMut;
use std::collections::HashMap;
use std::fmt::{Debug, Formatter};

use log::error;

use crate::ast::ast::{AstContext, AstPair, Expression, Identifier, Span, Statement};
use crate::error::Error;
use crate::interpret::matcher::assign_definitions;
use crate::interpret::value::Value;
use crate::stdlib::lib::stdlib;

#[derive(Debug, Clone)]
pub struct Context {
    pub ast_context: AstContext,
    pub scope_stack: Vec<Scope>,
}

#[derive(Debug, Clone)]
pub struct Scope {
    pub name: String,
    pub definitions: HashMap<Identifier, Definition>,
    pub callee: Option<Span>,
    pub arguments: Vec<AstPair<Value>>,
    pub method_callee: Option<AstPair<Value>>,
}

#[derive(Clone)]
pub enum Definition {
    User(AstPair<Identifier>, AstPair<Expression>),
    System(fn(Vec<AstPair<Value>>, &mut RefMut<Context>) -> Result<AstPair<Value>, Error>),
    Value(AstPair<Value>),
}

impl Debug for Definition {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Definition::User(i, exp) => write!(f, "{:?} = {:?}", i, exp),
            Definition::System(_) => write!(f, "<fn>"),
            Definition::Value(v) => write!(f, "{:?}", v),
        }
    }
}

impl Context {
    pub fn stdlib(a_ctx: AstContext) -> Context {
        let stdlib = stdlib();
        Context {
            ast_context: a_ctx,
            scope_stack: vec![Scope {
                name: "stdlib".to_string(),
                definitions: stdlib.into_iter().flat_map(|p| p.definitions).collect(),
                callee: None,
                arguments: vec![],
                method_callee: None,
            }],
        }
    }

    pub fn find_definition(&self, identifier: &Identifier) -> Option<Definition> {
        let r = self
            .scope_stack
            .iter()
            .rev()
            .filter_map(|s| s.definitions.get(&identifier))
            .cloned()
            .next();
        if let None = r {
            error!(
                "definition {} not found in scope stack {:?}",
                &identifier, &self.scope_stack
            );
        }
        r
    }
}

impl Statement {
    pub fn as_definitions(
        &self,
        ctx: &mut RefMut<Context>,
    ) -> Result<Vec<(Identifier, Definition)>, Error> {
        match self.clone() {
            Statement::Assignment {
                assignee,
                expression,
            } => assign_definitions(assignee, expression, ctx, |i, e| Definition::User(i, e)),
            _ => Ok(vec![]),
        }
    }
}
