use std::cell::RefMut;
use std::collections::HashMap;
use std::fmt::{Debug, Formatter};

use log::error;

use crate::ast::ast::{AstContext, AstPair, AstScope, Expression, Identifier, Span, Statement};
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
    pub arguments: Option<Vec<AstPair<Value>>>,
    pub method_callee: Option<AstPair<Value>>,
    pub return_value: Option<Value>,
}

impl Scope {
    pub fn new(name: String) -> Scope {
        Scope {
            name,
            definitions: HashMap::default(),
            callee: None,
            arguments: None,
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

    pub fn with_arguments(&self, arguments: Option<Vec<AstPair<Value>>>) -> Self {
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
pub struct SysFunction(
    pub fn(&Vec<AstPair<Value>>, &mut RefMut<Context>) -> Result<AstPair<Value>, Error>,
);

impl Debug for SysFunction {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "<system function>")
    }
}

#[derive(Debug, Clone)]
pub enum Definition {
    User(AstPair<Identifier>, AstPair<Expression>),
    System(SysFunction),
    Value(AstPair<Value>),
}

impl Context {
    pub fn stdlib(input: String) -> Context {
        let defs: HashMap<_, _> = stdlib().into_iter().flat_map(|p| p.definitions).collect();
        Context {
            ast_context: AstContext {
                input,
                global_scope: AstScope {
                    definitions: defs.keys().map(|i| (i.clone(), None)).collect(),
                    usage: HashMap::new(),
                },
                scope_stack: vec![AstScope::new()],
            },
            scope_stack: vec![Scope::new("stdlib".to_string()).with_definitions(defs)],
        }
    }

    pub fn find_definition(&self, identifier: &Identifier) -> Option<Definition> {
        let r = self
            .scope_stack
            .iter()
            .rev()
            .filter_map(|s| s.definitions.get(identifier))
            .next()
            .cloned();
        if r.is_none() {
            error!(
                "definition {} not found in scope stack {:?}",
                &identifier, &self.scope_stack
            );
        }
        r
    }

    pub fn find_definition_mut(&mut self, identifier: &Identifier) -> Option<&mut Definition> {
        let def = self
            .scope_stack
            .iter_mut()
            .rev()
            .filter_map(|s| s.definitions.get_mut(identifier))
            .next();
        if def.is_none() {
            error!("definition {} not found", &identifier);
        }
        def
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
            } => assign_definitions(assignee, expression, ctx, Definition::User),
            _ => Ok(vec![]),
        }
    }
}
