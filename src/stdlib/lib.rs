use std::cell::RefMut;
use std::collections::HashMap;

use crate::ast::ast::{Identifier, Span};
use crate::interpret::context::{Context, Definition};
use crate::stdlib::{binary_operator, io};

#[derive(Debug)]
pub struct Package {
    pub name: String,
    pub definitions: HashMap<Identifier, Definition>,
}

pub fn stdlib() -> Vec<Package> {
    vec![io::package(), binary_operator::package()]
}

pub fn callee(ctx: &mut RefMut<Context>) -> Option<Span> {
    ctx.scope_stack.last().unwrap().clone().callee
}
