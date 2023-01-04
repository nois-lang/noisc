use std::cell::RefMut;
use std::collections::HashMap;
use std::fmt::{Debug, Formatter};

use pest::error::Error;

use crate::ast::ast::{Assignee, AstContext, AstPair, Expression, Identifier, Span, Statement};
use crate::interpret::value::Value;
use crate::parser::Rule;
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
    pub params: Vec<AstPair<Value>>,
}

#[derive(Clone)]
pub enum Definition {
    User(AstPair<Identifier>, AstPair<Expression>),
    System(fn(Vec<AstPair<Value>>, &mut RefMut<Context>) -> Result<AstPair<Value>, Error<Rule>>),
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
                params: vec![],
            }],
        }
    }

    pub fn find_definition(&self, identifier: &Identifier) -> Option<Definition> {
        // TODO: only check local, global and stdlib scopes
        self.scope_stack
            .iter()
            .rev()
            .filter_map(|s| s.definitions.get(&identifier))
            .cloned()
            .next()
    }
}

impl Statement {
    pub fn as_definitions(&self) -> Vec<(Identifier, Definition)> {
        match self.clone() {
            Statement::Assignment {
                assignee,
                expression,
            } => assign_expression_definitions(&assignee, expression),
            _ => vec![],
        }
    }
}

pub fn assign_expression_definitions(
    assignee: &AstPair<Assignee>,
    expression: AstPair<Expression>,
) -> Vec<(Identifier, Definition)> {
    match assignee.clone().1 {
        Assignee::Identifier(i) => {
            vec![(i.clone().1, Definition::User(i, expression))]
        }
        Assignee::Hole => vec![],
        Assignee::Pattern(_) => todo!("patterns"),
    }
}

pub fn assign_value_definitions(
    assignee: &AstPair<Assignee>,
    value: AstPair<Value>,
) -> Vec<(Identifier, Definition)> {
    match assignee.clone().1 {
        Assignee::Identifier(i) => {
            vec![(i.clone().1, Definition::Value(value))]
        }
        Assignee::Hole => vec![],
        Assignee::Pattern(_) => todo!("patterns"),
    }
}
