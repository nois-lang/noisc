use std::cell::RefMut;
use std::collections::HashMap;

use crate::ast::ast::{AstPair, Identifier};
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

pub fn callee(assert_id: &Identifier, ctx: &mut RefMut<Context>) -> Option<AstPair<Identifier>> {
    ctx.scope_stack
        .last()
        .unwrap()
        .clone()
        .1
        .callee
        .filter(|i| &i.1 == assert_id)
}
