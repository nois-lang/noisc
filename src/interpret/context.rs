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
}

#[derive(Clone)]
pub enum Definition {
    User(AstPair<Identifier>, AstPair<Expression>),
    System(fn(Vec<&Value>) -> Value),
}

impl Debug for Definition {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Definition::User(i, exp) => write!(f, "{:?} = {:?}", i, exp),
            Definition::System(_) => write!(f, "<fn>"),
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
                },
            )],
        }
    }

    pub fn find(&self, identifier: Identifier) -> Option<Definition> {
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
            } => match assignee.1 {
                Assignee::Identifier(i) => {
                    vec![(i.clone().1, Definition::User(i, expression))]
                }
                Assignee::Hole => vec![],
                Assignee::Pattern(_) => todo!("patterns"),
            },
            _ => vec![],
        }
    }
}
