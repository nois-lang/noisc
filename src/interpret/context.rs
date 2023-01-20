use std::cell::RefMut;
use std::collections::HashMap;
use std::fmt::{Debug, Formatter};

use log::error;

use crate::ast::ast::{AstContext, AstPair, Expression, Identifier, Span, Statement};
use crate::error::Error;
use crate::interpret::destructure::assign_definitions;
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
    pub return_value: Option<Value>,
}

impl Scope {
    pub fn new(name: String) -> Scope {
        Scope {
            name,
            definitions: HashMap::default(),
            callee: None,
            arguments: vec![],
            method_callee: None,
            return_value: None,
        }
    }

    pub fn with_definitions(&self, definitions: HashMap<Identifier, Definition>) -> Self {
        let mut new = self.clone();
        new.definitions = definitions;
        new
    }

    pub fn with_callee(&self, callee: Option<Span>) -> Self {
        let mut new = self.clone();
        new.callee = callee;
        new
    }

    pub fn with_arguments(&self, arguments: Vec<AstPair<Value>>) -> Self {
        let mut new = self.clone();
        new.arguments = arguments;
        new
    }

    pub fn with_method_callee(&self, method_callee: Option<AstPair<Value>>) -> Self {
        let mut new = self.clone();
        new.method_callee = method_callee;
        new
    }

    pub fn with_return_value(&self, return_value: Option<Value>) -> Self {
        let mut new = self.clone();
        new.return_value = return_value;
        new
    }
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
        let defs = stdlib().into_iter().flat_map(|p| p.definitions).collect();
        Context {
            ast_context: a_ctx,
            scope_stack: vec![Scope::new("stdlib".to_string()).with_definitions(defs)],
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
