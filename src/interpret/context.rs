use crate::ast::ast::{AstPair, Expression, Identifier};
use crate::interpret::value::Value;
use crate::stdlib::lib::stdlib;
use std::collections::HashMap;
use std::fmt::{Debug, Formatter};

#[derive(Debug)]
pub struct Context {
    pub scope_stack: Vec<(Identifier, Scope)>,
}

#[derive(Debug)]
pub struct Scope {
    pub definitions: HashMap<Identifier, Definition>,
}

pub enum Definition {
    User(AstPair<Expression>),
    System(Box<dyn Fn(Vec<&Value>) -> Value>),
}

impl Debug for Definition {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Definition::User(exp) => Debug::fmt(exp, f),
            Definition::System(_) => write!(f, "<fn>"),
        }
    }
}

impl Context {
    pub fn new() -> Context {
        let stdlib = stdlib();
        Context {
            scope_stack: vec![(
                Identifier("stdlib".to_string()),
                Scope {
                    definitions: stdlib.into_iter().flat_map(|p| p.definitions).collect(),
                },
            )],
        }
    }
}
