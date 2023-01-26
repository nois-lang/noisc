use crate::ast::ast_context::AstContext;
use crate::ast::ast_pair::{AstPair, Span};
use crate::ast::expression::Expression;
use crate::ast::identifier::Identifier;
use crate::ast::statement::Statement;
use std::cell::RefMut;
use std::collections::HashMap;
use std::fmt::{Debug, Formatter};
use std::mem::take;
use std::rc::Rc;

use crate::error::Error;
use crate::interpret::destructure::{assign_definitions, AssignmentResult};
use crate::interpret::value::Value;
use crate::stdlib::lib::stdlib;

#[derive(Debug, Clone)]
pub struct Context {
    pub ast_context: AstContext,
    pub scope_stack: Vec<Scope>,
}

impl Context {
    pub fn stdlib(a_ctx: AstContext) -> Context {
        let defs: HashMap<_, _> = stdlib().into_iter().flat_map(|p| p.definitions).collect();
        Context {
            ast_context: a_ctx,
            scope_stack: vec![take(
                Scope::new("stdlib".to_string()).with_definitions(defs),
            )],
        }
    }

    pub fn find_definition(&self, identifier: &Identifier) -> Option<&Definition> {
        self.scope_stack
            .iter()
            .rev()
            .filter_map(|s| s.definitions.get(identifier))
            .next()
    }

    pub fn find_definition_mut(&mut self, identifier: &Identifier) -> Option<&mut Definition> {
        self.scope_stack
            .iter_mut()
            .rev()
            .filter_map(|s| s.definitions.get_mut(identifier))
            .next()
    }
}

#[derive(Debug, Clone, Default)]
pub struct Scope {
    pub name: String,
    pub definitions: HashMap<Identifier, Definition>,
    pub callee: Option<Span>,
    pub arguments: Option<Rc<Vec<AstPair<Rc<Value>>>>>,
    pub method_callee: Option<AstPair<Rc<Value>>>,
    pub return_value: Option<Rc<Value>>,
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

    pub fn with_definitions(&mut self, definitions: HashMap<Identifier, Definition>) -> &mut Self {
        self.definitions = definitions;
        self
    }

    pub fn with_callee(&mut self, callee: Option<Span>) -> &mut Self {
        self.callee = callee;
        self
    }

    pub fn with_arguments(&mut self, arguments: Option<Rc<Vec<AstPair<Rc<Value>>>>>) -> &mut Self {
        self.arguments = arguments;
        self
    }

    pub fn with_method_callee(&mut self, method_callee: Option<AstPair<Rc<Value>>>) -> &mut Self {
        self.method_callee = method_callee;
        self
    }

    pub fn with_return_value(&mut self, return_value: Option<Rc<Value>>) -> &mut Self {
        self.return_value = return_value;
        self
    }
}

#[derive(Clone, Copy)]
pub struct SysFunction(
    pub fn(&Vec<AstPair<Rc<Value>>>, &mut RefMut<Context>) -> Result<AstPair<Value>, Error>,
);

impl Debug for SysFunction {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "<system function>")
    }
}

#[derive(Debug, Clone)]
pub enum Definition {
    User(AstPair<Identifier>, AstPair<Rc<Expression>>),
    System(SysFunction),
    Value(AstPair<Rc<Value>>),
}

impl Statement {
    pub fn as_definitions(&self, ctx: &mut RefMut<Context>) -> Result<AssignmentResult, Error> {
        match self {
            Statement::Assignment {
                assignee,
                expression,
            } => assign_definitions(
                assignee,
                expression.map(|v| Rc::new(v.clone())),
                ctx,
                Definition::User,
            ),
            _ => Ok(AssignmentResult::default()),
        }
    }
}
