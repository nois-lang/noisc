use std::cell::RefMut;
use std::collections::HashMap;
use std::fmt::{Debug, Formatter};

use pest::error::Error;

use crate::ast::ast::{Assignee, AstContext, AstPair, Expression, Identifier, Statement};
use crate::interpret::value::Value;
use crate::parser::Rule;
use crate::stdlib::lib::stdlib;

#[derive(Debug, Clone)]
pub struct Context {
    pub ast_context: AstContext,
    pub scope_stack: Vec<(Identifier, Scope)>,
}

#[derive(Debug, Clone)]
pub struct Scope {
    pub definitions: HashMap<Identifier, Definition>,
    pub callee: Option<AstPair<Identifier>>,
    pub params: Vec<AstPair<Value>>,
}

impl Default for Scope {
    fn default() -> Self {
        Scope {
            definitions: HashMap::new(),
            callee: None,
            params: vec![],
        }
    }
}

#[derive(Clone)]
pub enum Definition {
    User(AstPair<Identifier>, AstPair<Expression>),
    // TODO: error reporting
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
    pub fn new(a_ctx: AstContext) -> Context {
        let stdlib = stdlib();
        Context {
            ast_context: a_ctx,
            scope_stack: vec![(
                Identifier::new("stdlib"),
                Scope {
                    definitions: stdlib.into_iter().flat_map(|p| p.definitions).collect(),
                    callee: None,
                    params: vec![],
                },
            )],
        }
    }

    pub fn find_global(&self, identifier: &Identifier) -> Option<Definition> {
        self.scope_stack
            .iter()
            .rev()
            .filter_map(|(_, s)| s.definitions.get(&identifier))
            .cloned()
            .next()
    }
    pub fn find_local(&self, identifier: &Identifier) -> Option<Definition> {
        self.scope_stack
            .last()
            .unwrap()
            .1
            .definitions
            .get(&identifier)
            .cloned()
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
