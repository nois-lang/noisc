use crate::ast::ast::{Assignee, AstPair, Expression, Identifier, Statement};
use crate::interpret::value::Value;
use crate::stdlib::lib::stdlib;
use std::collections::HashMap;
use std::fmt::{Debug, Formatter};

#[derive(Debug, Clone)]
pub struct Context {
    pub scope_stack: Vec<(Identifier, Scope)>,
}

#[derive(Debug, Clone)]
pub struct Scope {
    pub definitions: HashMap<Identifier, Definition>,
    pub params: Vec<Value>,
}

impl Default for Scope {
    fn default() -> Self {
        Scope {
            definitions: HashMap::new(),
            params: vec![],
        }
    }
}

#[derive(Clone)]
pub enum Definition {
    User(AstPair<Identifier>, AstPair<Expression>),
    System(fn(Vec<Value>) -> Value),
    Value(Value),
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
    pub fn new() -> Context {
        let stdlib = stdlib();
        Context {
            scope_stack: vec![(
                Identifier::new("stdlib"),
                Scope {
                    definitions: stdlib.into_iter().flat_map(|p| p.definitions).collect(),
                    params: vec![],
                },
            )],
        }
    }

    pub fn find(&self, identifier: &Identifier) -> Option<Definition> {
        self.scope_stack
            .iter()
            .filter_map(|(_, s)| s.definitions.get(&identifier))
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
    value: Value,
) -> Vec<(Identifier, Definition)> {
    match assignee.clone().1 {
        Assignee::Identifier(i) => {
            vec![(i.clone().1, Definition::Value(value))]
        }
        Assignee::Hole => vec![],
        Assignee::Pattern(_) => todo!("patterns"),
    }
}
